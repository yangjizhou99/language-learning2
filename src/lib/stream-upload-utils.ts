import { NextRequest } from 'next/server';
import busboy from 'busboy';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import type { IncomingMessage } from 'http';

export type ParsedFormData = {
    fields: Record<string, string>;
    files: Record<string, FileInfo>;
};

export type FileInfo = {
    filename: string;
    encoding: string;
    mimeType: string;
    tempFilePath: string;
    size: number;
};

/**
 * Parsed multipart/form-data request using busboy (streaming)
 * Saves files to temp directory and returns fields + file info
 */
export async function parseMultipartFormData(
    req: NextRequest | IncomingMessage,
    tempDir: string
): Promise<ParsedFormData> {
    return new Promise((resolve, reject) => {
        // Handle both Headers object (App Router) and incoming headers (Pages Router)
        const contentType = req.headers instanceof Headers
            ? req.headers.get('content-type')
            : req.headers['content-type'];

        if (!contentType || !contentType.includes('multipart/form-data')) {
            return reject(new Error('Content-Type must be multipart/form-data'));
        }

        const bb = busboy({ headers: { 'content-type': contentType } });
        const result: ParsedFormData = {
            fields: {},
            files: {},
        };
        const filePromises: Promise<void>[] = [];

        // Ensure temp dir exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        bb.on('file', (name, fileStream, info) => {
            const { filename, encoding, mimeType } = info;
            // Use a safe random filename for storage to avoid encoding/OS issues with special characters
            const safeName = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;
            const saveTo = path.join(tempDir, safeName);
            const writeStream = fs.createWriteStream(saveTo);

            const filePromise = new Promise<void>((fileResolve, fileReject) => {
                let size = 0;
                fileStream.on('data', (data) => {
                    size += data.length;
                });

                fileStream.on('error', fileReject);
                writeStream.on('error', fileReject);

                fileStream.pipe(writeStream);

                // Use 'close' event instead of 'finish' to ensure file descriptor is released (important on Windows)
                writeStream.on('close', () => {
                    result.files[name] = {
                        filename,
                        encoding,
                        mimeType,
                        tempFilePath: saveTo,
                        size
                    };
                    fileResolve();
                });
            });

            filePromises.push(filePromise);
        });

        bb.on('field', (name, val) => {
            result.fields[name] = val;
        });

        bb.on('close', async () => {
            try {
                await Promise.all(filePromises);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });

        bb.on('error', (err) => {
            reject(err);
        });

        // Handle stream piping based on request type
        if (req instanceof Readable) {
            // Pages Router: req is already a Node stream (IncomingMessage)
            req.pipe(bb);
        } else {
            // App Router: NextRequest with WebStream body
            // @ts-ignore
            if (req.body) {
                // @ts-ignore
                Readable.fromWeb(req.body).pipe(bb);
            } else {
                reject(new Error('Request body is empty'));
            }
        }
    });
}
