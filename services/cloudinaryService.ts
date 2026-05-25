import { v2 as cloudinary } from 'cloudinary';

let configured = false;

function ensureConfigured(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
  }

  return true;
}

export function isCloudinaryConfigured(): boolean {
  return ensureConfigured();
}

export async function uploadPdfBuffer(
  buffer: Buffer,
  fileName: string
): Promise<{ publicId: string; url: string }> {
  if (!ensureConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
    );
  }

  const baseName = fileName.replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_');
  const publicId = `pdf-review/${baseName}_${Date.now()}`;

  const result = await new Promise<{
    public_id: string;
    secure_url: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: publicId,
        folder: 'pdf-review/pdfs',
        format: 'pdf',
      },
      (error, uploadResult) => {
        if (error) reject(error);
        else if (!uploadResult) reject(new Error('Cloudinary upload returned no result'));
        else resolve(uploadResult as { public_id: string; secure_url: string });
      }
    );
    stream.end(buffer);
  });

  return {
    publicId: result.public_id,
    url: result.secure_url,
  };
}

export async function uploadPageImage(
  buffer: Buffer,
  documentId: number,
  pageNumber: number
): Promise<{ publicId: string; url: string }> {
  if (!ensureConfigured()) {
    throw new Error('Cloudinary is not configured.');
  }

  const publicId = `pdf-review/doc_${documentId}/page_${pageNumber}_${Date.now()}`;

  const result = await new Promise<{
    public_id: string;
    secure_url: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        public_id: publicId,
        folder: `pdf-review/doc_${documentId}/pages`,
        format: 'png',
      },
      (error, uploadResult) => {
        if (error) reject(error);
        else if (!uploadResult) reject(new Error('Cloudinary page upload failed'));
        else resolve(uploadResult as { public_id: string; secure_url: string });
      }
    );
    stream.end(buffer);
  });

  return {
    publicId: result.public_id,
    url: result.secure_url,
  };
}
