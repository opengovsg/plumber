const MB = 1024 * 1024

// Frontend picker limit for any attachment field. Postman also enforces it on
// save and at send time.
export const MAX_ATTACHMENT_COUNT = 10

export const MAX_ATTACHMENT_FILE_SIZE_MB = 20
export const MAX_ATTACHMENT_FILE_SIZE = MAX_ATTACHMENT_FILE_SIZE_MB * MB

// SES accepts messages up to 40MB after base64 encoding (~1.37x), so 20MB of
// raw attachments (~27MB encoded) stays under it. Postman's own limit is lower.
export const MAX_TOTAL_ATTACHMENT_SIZE_MB = 20
export const MAX_TOTAL_ATTACHMENT_SIZE = MAX_TOTAL_ATTACHMENT_SIZE_MB * MB

/**
 * Extensions SES refuses to send. A block-list, so any other extension is
 * accepted, subject to the malware scan.
 *
 * Keep in sync with https://docs.aws.amazon.com/ses/latest/dg/attachments.html
 */
export const SES_BLOCKED_EXTENSIONS: readonly string[] = [
  'ade',
  'adp',
  'app',
  'asp',
  'bas',
  'bat',
  'cer',
  'chm',
  'cmd',
  'com',
  'cpl',
  'crt',
  'csh',
  'der',
  'exe',
  'fxp',
  'gadget',
  'hlp',
  'hta',
  'inf',
  'ins',
  'isp',
  'its',
  'js',
  'jse',
  'ksh',
  'lib',
  'lnk',
  'mad',
  'maf',
  'mag',
  'mam',
  'maq',
  'mar',
  'mas',
  'mat',
  'mau',
  'mav',
  'maw',
  'mda',
  'mdb',
  'mde',
  'mdt',
  'mdw',
  'mdz',
  'msc',
  'msh',
  'msh1',
  'msh2',
  'mshxml',
  'msh1xml',
  'msh2xml',
  'msi',
  'msp',
  'mst',
  'ops',
  'pcd',
  'pif',
  'plg',
  'prf',
  'prg',
  'reg',
  'scf',
  'scr',
  'sct',
  'shb',
  'shs',
  'sys',
  'ps1',
  'ps1xml',
  'ps2',
  'ps2xml',
  'psc1',
  'psc2',
  'tmp',
  'url',
  'vb',
  'vbe',
  'vbs',
  'vps',
  'vsmacros',
  'vss',
  'vst',
  'vsw',
  'vxd',
  'ws',
  'wsc',
  'wsf',
  'wsh',
  'xnk',
]
