export const generateExternalLink = (link: string): React.ReactNode => (
  <a href={link} target="_blank">
    {link}
  </a>
);
