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

/**
 * Every image the message carries: its own attachments plus those of any
 * forwarded messages (a forward has no attachments of its own, so without this
 * a raider could forward the scam instead of posting it). Capped per message.
 */
export function imageAttachments(message: Message): Attachment[] {
  const own = [...message.attachments.values()];
  const forwarded = [...(message.messageSnapshots?.values() ?? [])].flatMap((snapshot) => [
    ...(snapshot.attachments?.values() ?? []),
  ]);
  return [...own, ...forwarded].filter(isImageAttachment).slice(0, 10);
}

/** Visible text of the message, including forwarded text. */
export function messageText(message: Message): string {
  const forwarded = [...(message.messageSnapshots?.values() ?? [])]
    .map((snapshot) => snapshot.content ?? '')
    .join(' ');
  return `${message.content} ${forwarded}`.trim();
}

/**
 * Proxy URL for an image rendered as PNG at a bounded size. Every image type
 * (including WebP, AVIF, HEIC, SVG) goes through Discord's media proxy this
 * way, so our decoders only ever see PNG produced by Discord.
 */
export function proxyPngUrl(attachment: Attachment, size: number): string {
  const base = attachment.proxyURL || attachment.url;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${size}&height=${size}&format=png`;
}

/** Signatures for every image attachment on a message (empty if none). */
export function imageSignatures(message: Message): string[] {
  return imageAttachments(message).map(attachmentSignature);
}

/**
 * Whether a post has the raid shape: images with no text, or only a short
 * caption that isn't a question ("hi", "look", "wow"). A member asking about
 * the image writes more than that.
 */
export function isRaidShaped(text: string): boolean {
  const t = text.trim();
  return t.length <= 20 && !t.includes('?') && !t.includes('\n');
}
