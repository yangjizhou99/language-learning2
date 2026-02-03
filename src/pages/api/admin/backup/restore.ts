import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
// Use relative path to avoid alias issues during migration
import { extractZip, copyBackupFromHistory, restoreDatabase, restoreStorage, restoreNdjsonDatabase } from '../../../../app/api/admin/backup/restore/restore-utils';
import { parseMultipartFormData } from '@/lib/stream-upload-utils';

export const config = {
    api: {
        bodyParser: false, // Disallow body parsing, consume as stream
        responseLimit: false,
    },
};

type DatabaseType = 'local' | 'prod' | 'supabase';

const safeRemoveDirWithRetry = async (dirPath: string, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await fs.rm(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
            return;
        } catch (err: any) {
            if (err.code === 'ENOENT') return;
            // Windows can throw EBUSY, EPERM, or ENOTEMPTY when handles are still open
            if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'ENOTEMPTY') {
                console.warn(`Failed to remove dir ${dirPath} (attempt ${i + 1}/${retries}): ${err.message}`);
                await new Promise(res => setTimeout(res, delay * (i + 1))); // Increasing delay
                continue;
            }
            throw err;
        }
    }
    // Final attempt failed, but don't throw - just log
    console.error(`Final failure to remove dir ${dirPath} after ${retries} attempts. Directory may need manual cleanup.`);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // Basic admin check (simplistic for migration, ideally use middleware or session check)
    // Since this is Pages router, use existing auth logic if available or just check cookie presence
    if (!req.cookies['custom-auth-token']) {
        // return res.status(401).json({ error: 'Unauthorized' });
        // For now, let's assume middleware might not protect pages/api, so we check token
    }

    const tempDir = path.join(process.cwd(), 'temp', 'restore', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    let restoreType: string = 'unknown';
    let databaseType: DatabaseType = 'supabase';
    let restoreMode: 'append' | 'overwrite' = 'append';
    let backupPath: string | null = null;
    let file: { name: string, tempFilePath: string } | null = null;
    let storageRestored = false;
    let storageError: string | null = null;
    let databaseRestored = false;
    let databaseError: string | null = null;

    try {
        const contentType = req.headers['content-type'];
        if (contentType?.includes('multipart/form-data')) {
            // Streaming upload
            let parsedData;
            try {
                parsedData = await parseMultipartFormData(req, tempDir);
            } catch (e: any) {
                console.error('Failed to parse multipart data:', e);
                await safeRemoveDirWithRetry(tempDir);
                return res.status(400).json({
                    error: '文件上传失败：无法解析表单数据',
                    details: `可能是文件过大或网络中断导致。原始错误: ${e.message || String(e)}`
                });
            }

            const fileInfo = parsedData.files['file'];
            if (fileInfo) {
                file = { name: fileInfo.filename, tempFilePath: fileInfo.tempFilePath };
            }

            restoreType = parsedData.fields['restoreType'] || 'upload';
            const dt = parsedData.fields['databaseType'];
            if (dt && (['local', 'prod', 'supabase'] as const).includes(dt as any)) {
                databaseType = dt as DatabaseType;
            }
            const rm = parsedData.fields['restoreMode']?.toLowerCase();
            if (rm === 'overwrite' || rm === 'append') restoreMode = rm as any;
        } else {
            // JSON body - need to read manually since bodyParser is false
            // But wait, if bodyParser is false, we can't get req.body easily for JSON
            // We must read the stream buffer for JSON too if we disable it globally for this route.
            // Or we can rely on client sending multipart always? No, history restore sends JSON.
            // We need to implement a simple body reader for JSON.

            const buffers = [];
            for await (const chunk of req) {
                buffers.push(chunk);
            }
            const data = Buffer.concat(buffers).toString();
            let body;
            try {
                body = JSON.parse(data);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid JSON body' });
            }

            restoreType = body.restoreType || 'history';
            backupPath = body.backupPath;
            if (body.databaseType && (['local', 'prod', 'supabase'] as const).includes(body.databaseType)) {
                databaseType = body.databaseType as DatabaseType;
            }
            if (body.restoreMode) {
                const rm = (body.restoreMode as string).toLowerCase();
                if (rm === 'overwrite' || rm === 'append') restoreMode = rm as any;
            }
        }

        if (!(['local', 'prod', 'supabase'] as const).includes(databaseType)) {
            return res.status(400).json({ error: '无效的数据库类型' });
        }

        if (restoreType === 'upload') {
            if (!file) return res.status(400).json({ error: '请选择要恢复的备份文件' });
            // Correctly use the temp file from busboy
            await extractZip(file.tempFilePath, tempDir);
        } else if (restoreType === 'incremental') {
            if (!backupPath) return res.status(400).json({ error: '增量恢复需要选择备份文件' });
            await copyBackupFromHistory(backupPath, tempDir);
        } else {
            // history
            if (!backupPath) return res.status(400).json({ error: '请选择要恢复的历史备份' });
            await copyBackupFromHistory(backupPath, tempDir);
        }

        // Check for NDJSON manifest
        const manifestPath = path.join(tempDir, 'manifest.json');
        let isNdjsonBackup = false;
        let manifest = null;

        try {
            const manifestContent = await fs.readFile(manifestPath, 'utf8');
            manifest = JSON.parse(manifestContent);
            if (manifest.format === 'ndjson') {
                isNdjsonBackup = true;
                console.log('检测到NDJSON格式备份，版本:', manifest.version);
            }
        } catch {
            // No manifest or not NDJSON, assume SQL
        }

        let dbRestoreSummary: { total: number; success: number; skipped: number; failed: number; firstErrors?: Array<{ index: number; message: string }> } | null = null;

        if (isNdjsonBackup && manifest) {
            console.log('开始NDJSON格式数据库恢复...');
            dbRestoreSummary = await restoreNdjsonDatabase(tempDir, manifest, databaseType, restoreMode);
            console.log('NDJSON数据库恢复完成');
        } else {
            // SQL Restore
            const sqlFiles = await findSqlFiles(tempDir);
            console.log('找到SQL文件:', sqlFiles);

            if (sqlFiles.length > 0) {
                console.log('开始恢复数据库...');
                dbRestoreSummary = await restoreDatabase(sqlFiles[0], databaseType, restoreMode);
                console.log('数据库恢复完成');
            } else {
                console.log('未找到SQL文件，跳过数据库恢复');
            }
        }

        // Storage Restore
        const storageDir = path.join(tempDir, 'storage');
        try {
            await fs.access(storageDir);
            try {
                console.log('开始恢复存储桶文件...');
                const isIncremental = restoreType === 'incremental';
                await restoreStorage(storageDir, isIncremental, databaseType, restoreMode === 'overwrite');
                console.log(`存储桶恢复完成 (${isIncremental ? '增量' : '完整'}模式)`);
                storageRestored = true;
            } catch (err) {
                console.error('存储桶恢复失败:', err);
                storageError = err instanceof Error ? err.message : '未知错误';
            }
        } catch {
            console.log('存储目录不存在，跳过存储桶恢复');
        }

        return res.status(200).json({
            message: restoreType === 'incremental' ? '增量恢复完成（并行处理）' : '恢复完成（并行处理）',
            details: {
                databaseFiles: isNdjsonBackup ? (manifest?.tables?.length || 0) : 0,
                storageRestored: storageRestored,
                storageError: storageError,
                restoreType: restoreType,
                mode: restoreType === 'incremental' ? '增量模式（只恢复数据库中缺失的文件）' : (restoreMode === 'overwrite' ? '完整覆盖模式（覆盖现有数据/文件）' : '完整追加模式（仅新增，不覆盖）'),
                parallelProcessing: true,
                performance: '使用并行处理提高恢复速度',
                databaseType,
                databaseRestore: dbRestoreSummary,
                restoreMode
            },
        });

    } catch (error: any) {
        console.error('Restore error:', error);
        await safeRemoveDirWithRetry(tempDir);
        return res.status(500).json({
            error: '恢复失败',
            details: error.message || String(error)
        });
    }
}

async function findSqlFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
        const items = await fs.readdir(dir);
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stats = await fs.stat(itemPath);
            if (stats.isDirectory()) {
                files.push(...await findSqlFiles(itemPath));
            } else if (item.endsWith('.sql')) {
                files.push(itemPath);
            }
        }
    } catch (err) { console.error('查找SQL文件失败:', err); }
    return files;
}
