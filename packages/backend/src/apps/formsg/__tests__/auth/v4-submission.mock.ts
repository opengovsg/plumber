import type { DecryptedContentV4 } from '@opengovsg/formsg-sdk'

/**
 * Shared by the decrypt-form-response.mrf and process-v4-responses tests.
 * Kept in a separate file while processResponsesV3 still exists; once the v3
 * path is removed, this can be inlined into the remaining v4 tests.
 */
export const exampleV4Submission: DecryptedContentV4 = {
  submissionSecretKey: '5TJG9xzu4PSzq2Ba9OvwFwtP9tpsychfakesecretKey',
  responses: {
    '69eedf3b2e18526ffea6335c': {
      fieldType: 'textfield',
      question: '[Myinfo] Name',
      answer: {
        value: 'AH KOW, TAN',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'name',
      },
    },
    '69eedf3ee69ec0227d5b44a1': {
      fieldType: 'dropdown',
      question: '[Myinfo] Sex',
      answer: {
        value: 'MALE',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'sex',
      },
    },
    '69eedf4120948ed94fae09b9': {
      fieldType: 'date',
      question: '[Myinfo] Date of birth',
      answer: {
        value: '12/01/1980',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'dob',
      },
    },
    '69eedf448962b17f28b5d6d3': {
      fieldType: 'dropdown',
      question: '[Myinfo] Race',
      answer: {
        value: 'CHINESE',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'race',
      },
    },
    '69eedf472e18526ffea6359a': {
      fieldType: 'dropdown',
      question: '[Myinfo] Nationality',
      answer: {
        value: 'SINGAPORE CITIZEN',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'nationality',
      },
    },
    '69eedf4a20948ed94fae0af9': {
      fieldType: 'dropdown',
      question: '[Myinfo] Birth country',
      answer: {
        value: 'SINGAPORE',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'birthcountry',
      },
    },
    '69eedf4e6df9349729779884': {
      fieldType: 'dropdown',
      question: '[Myinfo] Residential Status',
      answer: {
        value: 'CITIZEN',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'residentialstatus',
      },
    },
    '69eedf508844a134ddbb4da2': {
      fieldType: 'dropdown',
      question: '[Myinfo] Dialect',
      answer: {
        value: 'HOKKIEN',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'dialect',
      },
    },
    '69eedf55e83627c17770e283': {
      fieldType: 'dropdown',
      question: '[Myinfo] Housing type',
      answer: {
        value: 'CONDOMINIUM',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'housingtype',
      },
    },
    '69eedf589ebc72ac95a1c146': {
      fieldType: 'dropdown',
      question: '[Myinfo] HDB type',
      answer: {
        value: '4-ROOM FLAT (HDB)',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'hdbtype',
      },
    },
    '69eedf5cfd2757b0584e30a7': {
      fieldType: 'textfield',
      question: '[Myinfo] Passport number',
      answer: {
        value: 'K1234567A',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'passportnumber',
      },
    },
    '69eedf60e83627c17770e4e2': {
      fieldType: 'date',
      question: '[Myinfo] Passport expiry date',
      answer: {
        value: '01/01/2099',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'passportexpirydate',
      },
    },
    '69eedf646f410b5fe8efa650': {
      fieldType: 'textfield',
      question: '[Myinfo] Vehicle number',
      answer: {
        value: 'SBS9999A',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'vehno',
      },
    },
    '69eedf688962b17f28b5ddc1': {
      fieldType: 'textfield',
      question: '[Myinfo] Registered address',
      answer: {
        value: '123 TAN AH MENG ROAD, #15-20, SINGAPORE 123456',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'regadd',
      },
    },
    '69eedf6c4c4123822c147e79': {
      fieldType: 'mobile',
      question: '[Myinfo] Mobile number',
      answer: {
        value: '+6597654321',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'mobileno',
      },
    },
    '69eedf739ebc72ac95a1c630': {
      fieldType: 'dropdown',
      question: '[Myinfo] Occupation',
      answer: {
        value: 'SOFTWARE TEST CASE',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'occupation',
      },
    },
    '69eedf77c50e6bea6bfcf0e9': {
      fieldType: 'textfield',
      question: '[Myinfo] Name of employer',
      answer: {
        value: 'PLUMBER',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'employment',
      },
    },
    '69eedf7c12e0ebead02e428b': {
      fieldType: 'dropdown',
      question: '[Myinfo] Workpass status',
      answer: {
        value: 'Live',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'workpassstatus',
      },
    },
    '69eedf81426d1b5cb465d8df': {
      fieldType: 'date',
      question: '[Myinfo] Workpass expiry date',
      answer: {
        value: '02/09/2098',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'workpassexpirydate',
      },
    },
    '69eedf89fd2757b0584e3a9b': {
      fieldType: 'textfield',
      question: '[Myinfo] Vehicle number',
      answer: {
        value: 'SBS9999A',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'vehno',
      },
    },
    '69eedf91ed3e04f8606c401c': {
      fieldType: 'textfield',
      question: '[Myinfo] Registered address',
      answer: {
        value: '123 TAN AH MENG ROAD, #15-20, SINGAPORE 123456',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'regadd',
      },
    },
    '69eedf97e69ec0227d5b54ed': {
      fieldType: 'mobile',
      question: '[Myinfo] Mobile number',
      answer: {
        value: '+6597654321',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'mobileno',
      },
    },
    '69eedf9dc50e6bea6bfcf974': {
      fieldType: 'dropdown',
      question: '[Myinfo] Occupation',
      answer: {
        value: 'Test Case (Special)',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'occupation',
      },
    },
    '69eedfa120948ed94fae1f9f': {
      fieldType: 'textfield',
      question: '[Myinfo] Name of employer',
      answer: {
        value: 'PLUMBER',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'employment',
      },
    },
    '69eedfa58844a134ddbb622b': {
      fieldType: 'dropdown',
      question: '[Myinfo] Workpass status',
      answer: {
        value: 'Live',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'workpassstatus',
      },
    },
    '69eedfb120948ed94fae2422': {
      fieldType: 'date',
      question: '[Myinfo] Workpass expiry date',
      answer: {
        value: '02/09/2098',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'workpassexpirydate',
      },
    },
    '69eedfb5426d1b5cb465e1a4': {
      fieldType: 'dropdown',
      question: '[Myinfo] Marital status',
      answer: {
        value: 'SINGLE',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'marital',
      },
    },
    '69eedfb9d19891b7776ee43f': {
      fieldType: 'dropdown',
      question: '[Myinfo] Country of marriage',
      answer: {
        value: 'SINGAPORE',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'countryofmarriage',
      },
    },
    '69eedfbed19891b7776ee5be': {
      fieldType: 'textfield',
      question: '[Myinfo] Marriage cert. no.',
      answer: {
        value: 'ASDF',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'marriagecertno',
      },
    },
    '69eedfc1d19891b7776ee6f8': {
      fieldType: 'date',
      question: '[Myinfo] Marriage date',
      answer: {
        value: '02/09/2010',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
      myInfo: {
        attr: 'marriagedate',
      },
    },
    '69eeddc9e69ec0227d5ae7e0': {
      fieldType: 'textfield',
      question: 'Short answer',
      answer: {
        value: 'ASDF',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eeddcb77a3d021a8cdce44': {
      fieldType: 'textarea',
      question: 'Long answer',
      answer: {
        value: 'ASDF',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eeddcf8844a134ddbadc56': {
      fieldType: 'radiobutton',
      question: 'Radio',
      answer: {
        value: 'Option 2',
        isOthersInput: false,
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eeddd53c9ffa7a2b464687': {
      fieldType: 'radiobutton',
      question: 'Radio',
      answer: {
        value: 'adg',
        isOthersInput: true,
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eedde26f410b5fe8ef4683': {
      fieldType: 'checkbox',
      question: 'Checkbox',
      answer: {
        value: ['Option 2'],
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eedde76df93497297710b1': {
      fieldType: 'checkbox',
      question: 'Checkbox',
      answer: {
        value: [
          'Option 2',
          '!!FORMSG_INTERNAL_CHECKBOX_OTHERS_VALUE!!',
          'Option 1',
        ],
        othersInput: 'adw',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eeddec1b3ae67c084a5f1b': {
      fieldType: 'dropdown',
      question: 'Dropdown',
      answer: {
        value: 'Option 1',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eeddf02f788da6393f970f': {
      fieldType: 'rating',
      question: 'Rating',
      answer: {
        value: '5',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eeddf42f788da6393f982e': {
      fieldType: 'yes_no',
      question: 'Yes/No',
      answer: {
        value: 'Yes',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eede378844a134ddbaf4e8': {
      fieldType: 'number',
      question: 'Number',
      answer: {
        value: '1',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eede4704aec0d4bc3eda9e': {
      fieldType: 'decimal',
      question: 'Decimal',
      answer: {
        value: '0.5',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eede7804aec0d4bc3ee296': {
      fieldType: 'date',
      question: 'Date',
      answer: {
        value: '02/01/2914',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eede868c2bfbb8748c75d3': {
      fieldType: 'email',
      question: 'Email',
      answer: {
        value: 'ahkow@open.gov.local',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eede812e18526ffea60af3': {
      fieldType: 'email',
      question: 'Email',
      answer: {
        value: 'ahkow@open.gov.local',
        signature:
          'f=99eedd9b7cfa2c89fc415899,v=69eee0b21b3ae67c084af5fe,t=1777262773570,s=aWf2CiOKzsgV2HPNwAbjo60Na1fdEfvwtJS41S47TOvP0Y+pOk2OnyqH/OLFHRQP13rQDMVbVHtKvdDK9jo7A',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eede8a426d1b5cb465a369': {
      fieldType: 'mobile',
      question: 'Mobile number',
      answer: {
        value: '+6597654321',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eede9304aec0d4bc3ee7c7': {
      fieldType: 'mobile',
      question: 'Mobile number',
      answer: {
        value: '+6597654321',
        signature:
          'f=99eedd9b7cfa1c09fc415899,v=69eee0b51g1ae67c084af5fe,t=1777262791314,s=4GUZQbkSFFyCZ8WCNOk0NKNyBc+ty2J0mJoyBSyTvw64AWDCU0GOFyhjx8zPQuuCnWXx4RncrwsMok+2duWrBC',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eede9a9fae78f997888a57': {
      fieldType: 'homeno',
      question: 'Home number',
      answer: {
        value: '+14527178579',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eede9f2f788da6393fbd91': {
      fieldType: 'address',
      question: 'Local address',
      answer: {
        postalCode: {
          value: '123456',
        },
        blockNumber: {
          value: '123',
        },
        streetName: {
          value: 'TAN AH MENG ROAD',
        },
        buildingName: {
          value: '',
        },
        levelNumber: {
          value: '',
        },
        unitNumber: {
          value: '',
        },
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eedea3d19891b7776ea8bc': {
      fieldType: 'nric',
      question: 'NRIC/FIN',
      answer: {
        value: 'S1234567D',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eedea8cd86908422560589': {
      fieldType: 'uen',
      question: 'UEN',
      answer: {
        value: '200700940A',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eedead7cfa1c89fc419280': {
      fieldType: 'country_region',
      question: 'Country/Region',
      answer: {
        value: 'SINGAPORE',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eedeb17cfa1c89fc419340': {
      fieldType: 'signature',
      question: 'Signature',
      answer: {
        value: [
          [
            [167.8428955078125, 74.453125, 0.5],
            [179.0538330078125, 73.73698425292969, 0.5],
          ],
        ],
        type: 'draw',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eedec5fd2757b0584e0be5': {
      fieldType: 'table',
      question: 'Table',
      answer: {
        'ea3a9336-ae9c-46ee-a544-df0a0f911d41': {
          rowNum: 0,
          value: {
            '69eedec5fd2757b0584e0be6': 'a',
            '69eedec5fd2757b0584e0be7': 'Option 1',
          },
        },
        '7d7bbee6-9f68-445e-878d-84904eaacdde': {
          rowNum: 1,
          value: {
            '69eedec5fd2757b0584e0be6': 'b',
            '69eedec5fd2757b0584e0be7': 'Option 2',
          },
        },
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
    '69eedecafd2757b0584e0c54': {
      fieldType: 'attachment',
      question: 'Attachment',
      answer: {
        value: 'Screenshot.png',
        hasBeenScanned: true,
        // real payloads carry the digest as raw (non-printable) bytes;
        // replaced with a fake hex digest since nothing reads it
        md5Hash: 'd41d8cd98f00b204e9800998ecf8427e',
      },
      provenance: {
        submittedAt: '2026-06-02T05:00:53.879Z',
      },
    },
  },
  verified: {
    'uinFin (Step 1)': 'S1234567D',
  },
}

export function makeExampleV4FormSchema() {
  return {
    form: {
      form_fields: Object.entries(exampleV4Submission.responses).map(
        ([_id, response]) => ({
          _id,
          fieldType: response.fieldType,
          // Schema API doesn't have the "[Myinfo] " prefix
          title: response.question.replace(/^\[Myinfo\] /, ''),
          ...(response.fieldType === 'table' && {
            columns: [
              { title: 'Column 1', _id: '69eedec5fd2757b0584e0be6' },
              { title: 'Column 2', _id: '69eedec5fd2757b0584e0be7' },
            ],
          }),
        }),
      ),
    },
  }
}
