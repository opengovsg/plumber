import type { StreamTextTransform, TextStreamPart, ToolSet } from 'ai'

import { SUPPORT_FORM_URL_PLACEHOLDER } from '@/helpers/ai/build-support-form-url'

function placeholderPrefixLength(text: string): number {
  for (
    let length = Math.min(SUPPORT_FORM_URL_PLACEHOLDER.length - 1, text.length);
    length > 0;
    length--
  ) {
    if (text.endsWith(SUPPORT_FORM_URL_PLACEHOLDER.slice(0, length))) {
      return length
    }
  }
  return 0
}

/**
 * Replaces the support form URL placeholder in streamed text with this chat's URL.
 *
 * The cached system prompt keeps the placeholder so that chats can share it.
 * Text that might start a placeholder is held back until the next delta settles it.
 */
export function replaceSupportFormUrlPlaceholder(
  supportFormUrl: string,
): StreamTextTransform<ToolSet> {
  return () => {
    const pendingById = new Map<string, string>()

    const flush = (
      id: string,
      controller: TransformStreamDefaultController<TextStreamPart<ToolSet>>,
    ) => {
      const pending = pendingById.get(id)
      pendingById.delete(id)
      if (pending) {
        controller.enqueue({ type: 'text-delta', id, text: pending })
      }
    }

    return new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>(
      {
        transform(chunk, controller) {
          if (chunk.type === 'text-delta') {
            const text = (
              (pendingById.get(chunk.id) ?? '') + chunk.text
            ).replaceAll(SUPPORT_FORM_URL_PLACEHOLDER, supportFormUrl)
            const heldLength = placeholderPrefixLength(text)
            pendingById.set(chunk.id, text.slice(text.length - heldLength))
            const ready = text.slice(0, text.length - heldLength)
            if (ready) {
              controller.enqueue({ ...chunk, text: ready })
            }
            return
          }
          if (chunk.type === 'text-end') {
            flush(chunk.id, controller)
          }
          controller.enqueue(chunk)
        },
        flush(controller) {
          for (const id of [...pendingById.keys()]) {
            flush(id, controller)
          }
        },
      },
    )
  }
}
