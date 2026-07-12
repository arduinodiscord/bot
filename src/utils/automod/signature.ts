import type { Attachment, Message } from 'discord.js';

/**
 * A cheap, download-free fingerprint of an image attachment built from
 * metadata Discord already gives us (content type, byte size, dimensions).
 *
 * Re-uploads of the *same* image file produce an identical signature, which is
 * enough to spot the "same advert fanned across several channels" pattern
 * without ever fetching image bytes. It is intentionally conservative: it can
 * miss re-encoded/resized variants (a future perceptual-hash upgrade would
 * catch those), but it never decodes untrusted media and costs nothing on the
 * hot path.
 */
export function attachmentSignature(attachment: Attachment): string {
  const type = attachment.contentType ?? 'image/unknown';
  const dimensions =
    attachment.width && attachment.height
      ? `${attachment.width}x${attachment.height}`
      : 'na';
  return `${type}|${attachment.size}|${dimensions}`;
}

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|avif)$/i;

/** Whether an attachment is an image we should inspect. */
export function isImageAttachment(attachment: Attachment): boolean {
  if (attachment.contentType)
    return attachment.contentType.startsWith('image/');
  // Fall back to the file extension when Discord omits the content type.
  return IMAGE_EXTENSION.test(attachment.name ?? '');
}

/** Signatures for every image attachment on a message (empty if none). */
export function imageSignatures(message: Message): string[] {
  return [...message.attachments.values()]
    .filter(isImageAttachment)
    .map(attachmentSignature);
}
