import { useTheme } from '@chakra-ui/react'
import { css, Global } from '@emotion/react'

export function JSONViewerStyles() {
  const theme = useTheme()

  return (
    <Global
      styles={css`
        json-viewer {
          --background-color: transparent;
          --font-family: monaco, Consolas, Lucida Console, monospace;
          --font-size: 1rem;
          --indent-size: 1.5em;
          --indentguide-size: 1px;
          --indentguide-style: solid;
          --indentguide-color: ${theme.colors.gray[700]};
          --indentguide-color-active: #666;
          --indentguide: var(--indentguide-size) var(--indentguide-style)
            var(--indentguide-color);
          --indentguide-active: var(--indentguide-size) var(--indentguide-style)
            var(--indentguide-color-active);

          /* Types colors */
          --string-color: ${theme.colors.gray[600]};
          --number-color: ${theme.colors.gray[800]};
          --boolean-color: ${theme.colors.gray[800]};
          --null-color: ${theme.colors.gray[800]};
          --property-color: ${theme.colors.gray[800]};

          /* Collapsed node preview */
          --preview-color: ${theme.colors.gray[800]};

          /* Search highlight color */
          --highlight-color: #6fb3d2;
        }
      `}
    />
  )
}
