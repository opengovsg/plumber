import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Container,
  Heading,
  Text,
} from '@chakra-ui/react'

import MarkdownRenderer from '@/components/MarkdownRenderer'
import * as URLS from '@/config/urls'

const faqs = [
  {
    question: 'Is Plumber free?',
    answer: 'Yes, just log in with your gov.sg email address to try it out.',
  },
  {
    question: 'How is Plumber different from other automation tools?',
    answer:
      'We are focused on making Plumber as user-friendly as possible. We are also integrated with other OGP tools such as FormSG, LetterSG and PaySG. ',
  },
  {
    question: 'Do you offer technical support?',
    answer: `If you run into any difficulties setting up your workflows, you can reach out to us [here](${URLS.SUPPORT_FORM_LINK}).`,
  },
  {
    question: 'Which agencies are using Plumber?',
    answer:
      'There are over 190 agencies using Plumber. Some of them include SPF, MOM, MOE and MOH.',
  },
  // Add more FAQs as needed
]

export default function FaqSection() {
  return (
    <Box bg="white" py={{ base: 24, sm: 32 }}>
      <Container maxW="7xl" px={{ base: 6, lg: 8, sm: 8 }}>
        <Box maxW="4xl" mx="auto">
          <Heading
            fontSize={{ base: '4xl', sm: '5xl', lg: '48px' }}
            fontWeight="500"
            color="gray.900"
            textAlign="center"
            letterSpacing="tighter"
          >
            Got a question for us?
          </Heading>

          <Accordion mt={16} defaultIndex={[]} allowMultiple>
            {faqs.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                py={6}
                borderTop={index === 0 ? 'none' : '1px solid'}
                borderBottom={index === faqs.length - 1 ? 'none' : '1px solid'}
                borderColor={
                  index === 0 && index === faqs.length - 1
                    ? 'transparent'
                    : 'gray.100'
                }
                _hover={{ bg: 'transparent' }}
              >
                <AccordionButton
                  px={0}
                  _expanded={{ fontWeight: 'medium' }}
                  justifyContent="space-between"
                  textAlign="left"
                  _hover={{ bg: 'transparent' }}
                >
                  <Box as="span" fontSize="base" flex="1" textAlign="left">
                    {faq.question}
                  </Box>
                  <AccordionIcon />
                </AccordionButton>

                <AccordionPanel mt={2} pr={12} px={0}>
                  <MarkdownRenderer
                    source={faq.answer}
                    components={{
                      p: ({ children }) => (
                        <Text fontSize="base" color="gray.600">
                          {children}
                        </Text>
                      ),
                    }}
                  />
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </Box>
      </Container>
    </Box>
  )
}
