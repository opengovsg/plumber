import { createTheme, alpha } from '@mui/material/styles';
import { cardActionAreaClasses } from '@mui/material/CardActionArea';

const referenceTheme = createTheme();

const extendedTheme = createTheme({
  palette: {
    primary: {
      main: '#CF1A68',
      light: '#ED6EA5',
      dark: '#7F1040',
      contrastText: '#fff'
    },
    divider: 'rgba(194, 194, 194, .2)',
    common: {
      black: '#1D1D1D',
      white: '#fff'
    },
    text: {
      primary: '#001F52',
      secondary: '#5C5C5C',
      disabled: '#C2C2C2'
    },
    error: {
      main: '#F44336',
      light: '#F88078',
      dark: '#E31B0C',
      contrastText: '#fff'
    },
    success: {
      main: '#4CAF50',
      light: '#7BC67E',
      dark: '#3B873E',
      contrastText: '#fff'
    },
    warning: {
      main: '#ED6C02',
      light: '#FFB547',
      dark: '#C77700',
      contrastText: 'rgba(0, 0, 0, 0.87)'
    },
    secondary: {
      main: '#0059F7',
      light: '#4286FF',
      dark: '#001F52',
      contrastText: '#fff'
    },
    info: {
      main: '#6B6F8D',
      light: '#CED0E4',
      dark: '#484B6C',
      contrastText: '#fff'
    },
    background: {
      paper: '#fff',
      default: '#FAFAFA'
    }
  },
  shape: {
    borderRadius: 4
  },
  typography: {
    fontFamily: [
      'Inter',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
    h1: {
      fontSize: referenceTheme.typography.pxToRem(72),
      lineHeight: 1.11,
      fontWeight: 700,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(48)
      }
    },
    h2: {
      fontSize: referenceTheme.typography.pxToRem(48),
      lineHeight: 1.16,
      fontWeight: 700,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(24)
      }
    },
    h3: {
      fontSize: referenceTheme.typography.pxToRem(32),
      lineHeight: 1.16,
      fontWeight: 700,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(24)
      }
    },
    h4: {
      fontSize: referenceTheme.typography.pxToRem(32),
      lineHeight: 1.3,
      fontWeight: 700,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(16)
      }
    },
    h5: {
      fontSize: referenceTheme.typography.pxToRem(24),
      lineHeight: 1.3,
      fontWeight: 400,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(16)
      }
    },
    h6: {
      fontSize: referenceTheme.typography.pxToRem(20),
      lineHeight: 1.2,
      fontWeight: 500,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(20)
      }
    },
    subtitle1: {
      fontSize: referenceTheme.typography.pxToRem(14),
      lineHeight: 1.71,
      fontWeight: 400,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(14)
      },
      textTransform: 'uppercase'
    },
    subtitle2: {
      fontSize: referenceTheme.typography.pxToRem(14),
      lineHeight: 1.14,
      fontWeight: 400,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(14)
      }
    },
    body1: {
      fontSize: referenceTheme.typography.pxToRem(16),
      lineHeight: 1.5,
      fontWeight: 400,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(16)
      }
    },
    body2: {
      fontSize: referenceTheme.typography.pxToRem(16),
      lineHeight: 1.5,
      fontWeight: 700,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(16)
      }
    },
    button: {
      fontSize: referenceTheme.typography.pxToRem(16),
      fontWeight: 700,
      [referenceTheme.breakpoints.down('sm')]: {
        fontSize: referenceTheme.typography.pxToRem(16)
      }
    }
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          background: theme.palette.primary.dark,
          zIndex: theme.zIndex.drawer + 1
        })
      },
      defaultProps: {
        elevation: 2
      }
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          background: 'rgba(0, 8, 20, 0.64)'
        },
        invisible: {
          background: 'transparent'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none'
        },
        sizeLarge: {
          padding: '14px 22px'
        },
        sizeMedium: {
          padding: '10px 16px'
        },
        sizeSmall: {
          padding: '6px 10px'
        }
      }
    },
    MuiCardActionArea: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius,
          [`& .${cardActionAreaClasses.focusHighlight}`]: {
            background: 'unset',
            border: `1px solid ${alpha(theme.palette.primary.light, 1)}`
          },
          [`&:hover .${cardActionAreaClasses.focusHighlight}`]: {
            opacity: 1
          }
        })
      }
    },
    MuiContainer: {
      defaultProps: {
        maxWidth: 'xl'
      }
    },
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollBehavior: 'smooth'
        },
        a: {
          textDecoration: 'none'
        },
        '#root': {
          height: '100vh'
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paperWidthSm: ({ theme }) => ({
          margin: theme.spacing(4, 3),
          width: `calc(100% - ${theme.spacing(6)})`
        })
      }
    },
    MuiDialogContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&&': {
            paddingTop: theme.spacing(2)
          }
        })
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: ({ theme }) => ({
          paddingTop: theme.spacing(3)
        })
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        inputSizeSmall: ({ theme }) => ({
          // 1.5625 = 12.5px based on 1 = 8px
          padding: theme.spacing(1.5625, 1.75)
        })
      }
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          [theme.breakpoints.up('sm')]: {
            padding: theme.spacing(1.5, 3)
          }
        })
      }
    },
    MuiToolbar: {
      styleOverrides: {
        root: ({ theme }) => ({
          '@media all': {
            paddingRight: theme.spacing(1.5)
          }
        })
      }
    }
  }
});

export default extendedTheme;
