/**
 * Cloudinary Integration for Content Dealer Videos
 *
 * Used for generating PDF copy decks with video thumbnails.
 * Content dealer videos are stored in Cloudinary under "Turnkey_Content_Dealers/" folder.
 *
 * Naming convention: "Post_{number}_{suffix}" (e.g., "Post_667_nvatv6")
 * - Underscore format (Cloudinary adds random suffix on upload)
 * - NO "C" suffix (that's for FULL dealers in Google Drive)
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryVideoInfo {
  publicId: string;
  name: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration?: number;
  width?: number;
  height?: number;
}

/**
 * Get video info from Cloudinary by post number
 * Searches in "Turnkey_Content_Dealers/" folder for "Post_{number}_*" videos
 */
export async function getCloudinaryVideo(postNumber: number): Promise<CloudinaryVideoInfo | null> {
  try {
    // Search for video by name in the folder
    // Files are named like "Post_667_nvatv6" (underscore format with random suffix)
    const searchResult = await cloudinary.search
      .expression(`folder:"Turnkey_Content_Dealers" AND filename:Post_${postNumber}_* AND resource_type:video`)
      .max_results(1)
      .execute();

    if (!searchResult.resources || searchResult.resources.length === 0) {
      console.log(`[cloudinary] Post ${postNumber}: No video found`);
      return null;
    }

    const video = searchResult.resources[0];
    const publicId = video.public_id;

    console.log(`[cloudinary] Post ${postNumber}: Found "${video.filename}", public_id=${publicId}`);

    // Generate thumbnail URL (frame from video)
    // so_auto lets Cloudinary pick a representative frame automatically
    // w_400 is width 400px
    const thumbnailUrl = cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { width: 400, crop: 'limit' },
        { start_offset: 'auto' }, // Cloudinary picks best frame
      ],
    });

    // Video URL
    const videoUrl = cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'mp4',
    });

    return {
      publicId,
      name: video.filename || `Post ${postNumber}`,
      thumbnailUrl,
      videoUrl,
      duration: video.duration,
      width: video.width,
      height: video.height,
    };
  } catch (error) {
    console.error(`[cloudinary] Error finding video for post ${postNumber}:`, error);
    return null;
  }
}

/**
 * Fetch thumbnail image buffer from Cloudinary
 * Returns Uint8Array suitable for embedding in PDF
 */
export async function fetchCloudinaryThumbnail(postNumber: number): Promise<Uint8Array | null> {
  const videoInfo = await getCloudinaryVideo(postNumber);
  if (!videoInfo) {
    return null;
  }

  try {
    const response = await fetch(videoInfo.thumbnailUrl);
    if (!response.ok) {
      console.log(`[cloudinary] Thumbnail fetch failed for post ${postNumber}: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength < 500) {
      console.log(`[cloudinary] Thumbnail too small for post ${postNumber}: ${arrayBuffer.byteLength} bytes`);
      return null;
    }

    console.log(`[cloudinary] Thumbnail success for post ${postNumber}: ${arrayBuffer.byteLength} bytes`);
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error(`[cloudinary] Error fetching thumbnail for post ${postNumber}:`, error);
    return null;
  }
}

/**
 * Test Cloudinary connection and configuration
 */
export async function testCloudinaryConnection(): Promise<{
  success: boolean;
  cloudName?: string;
  error?: string;
}> {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return {
        success: false,
        error: 'Missing Cloudinary credentials in environment variables',
      };
    }

    // Try to ping the API
    const result = await cloudinary.api.ping();

    return {
      success: result.status === 'ok',
      cloudName,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default cloudinary;
