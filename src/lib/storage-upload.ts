import { getServiceSupabase } from './supabaseAdmin';

/**
 * 设置文件的缓存头
 * 通过重新上传文件来设置缓存策略
 */
async function setFileCacheControl(
  bucket: string,
  path: string,
  cacheControl: string,
): Promise<void> {
  const supabase = getServiceSupabase();

  // 下载文件
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(path);

  if (downloadError || !fileData) {
    throw new Error(`下载文件失败: ${downloadError?.message || 'Unknown error'}`);
  }

  // 重新上传文件，这次设置缓存头
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, fileData, {
    upsert: true,
    cacheControl: cacheControl,
  });

  if (uploadError) {
    throw new Error(`设置缓存头失败: ${uploadError.message}`);
  }
}

/**
 * 统一的文件上传函数，自动添加缓存头
 * 确保所有新上传的文件都有正确的缓存策略
 */

export interface UploadOptions {
  bucket: string;
  path: string;
  file: Buffer | Blob | File;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

/**
 * 上传文件到 Supabase Storage，自动添加缓存头
 */
export async function uploadWithCache(
  options: UploadOptions,
): Promise<{ success: boolean; url?: string; proxyUrl?: string; error?: string }> {
  try {
    const supabase = getServiceSupabase();

    // 默认缓存策略：30天缓存
    const defaultCacheControl = 'public, max-age=2592000, immutable';

    const { error } = await supabase.storage
      .from(options.bucket)
      .upload(options.path, options.file, {
        contentType: options.contentType || 'audio/mpeg',
        upsert: options.upsert || false,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    // 生成公共URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(options.bucket).getPublicUrl(options.path);

    // 生成代理路由URL（推荐使用）：改为“相对路径”，避免环境耦合
    const proxyUrl = `/api/storage-proxy?path=${options.path}&bucket=${options.bucket}`;

    return {
      success: true,
      url: publicUrl, // 原始 Supabase URL
      proxyUrl: proxyUrl, // 代理路由 URL（推荐）
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 上传音频文件（TTS/录音）
 */
export async function uploadAudioFile(
  bucket: string,
  path: string,
  audioBuffer: Buffer,
  options: {
    contentType?: string;
    cacheControl?: string;
    upsert?: boolean;
  } = {},
): Promise<{ success: boolean; url?: string; proxyUrl?: string; error?: string }> {
  return uploadWithCache({
    bucket,
    path,
    file: audioBuffer,
    contentType: options.contentType || 'audio/mpeg',
    cacheControl: options.cacheControl || 'public, max-age=2592000, immutable',
    upsert: options.upsert || false,
  });
}

/**
 * 上传图片文件
 */
export async function uploadImageFile(
  bucket: string,
  path: string,
  imageBuffer: Buffer,
  options: {
    contentType?: string;
    cacheControl?: string;
    upsert?: boolean;
  } = {},
): Promise<{ success: boolean; url?: string; proxyUrl?: string; error?: string }> {
  return uploadWithCache({
    bucket,
    path,
    file: imageBuffer,
    contentType: options.contentType || 'image/jpeg',
    cacheControl: options.cacheControl || 'public, max-age=2592000, immutable',
    upsert: options.upsert || false,
  });
}

/**
 * 上传文档文件
 */
export async function uploadDocumentFile(
  bucket: string,
  path: string,
  documentBuffer: Buffer,
  options: {
    contentType?: string;
    cacheControl?: string;
    upsert?: boolean;
  } = {},
): Promise<{ success: boolean; url?: string; proxyUrl?: string; error?: string }> {
  return uploadWithCache({
    bucket,
    path,
    file: documentBuffer,
    contentType: options.contentType || 'application/octet-stream',
    cacheControl: options.cacheControl || 'public, max-age=86400', // 1天缓存
    upsert: options.upsert || false,
  });
}

/**
 * 获取文件缓存策略
 */
export function getCacheControl(fileType: 'audio' | 'image' | 'document' | 'video'): string {
  const cacheStrategies = {
    audio: 'public, max-age=2592000, immutable', // 30天
    image: 'public, max-age=2592000, immutable', // 30天
    video: 'public, max-age=2592000, immutable', // 30天
    document: 'public, max-age=86400', // 1天
  };

  return cacheStrategies[fileType];
}
