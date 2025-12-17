export const DEFAULT_PROMPT_VALUES = {
  analyse: `<p style="margin: 0;font-weight: bold;">Analyse the following content and provide insights on:</p><p></p><p style="margin: 0"><span data-type="variable" data-id="step.00000000-0000-0000-0000-000000000000.Replace this with the content to analyse" data-label="Replace this with the content to analyse" data-value>{{step.00000000-0000-0000-0000-000000000000.Replace this with the content to analyse}}</span></p><p style="margin: 0"> </p><p style="margin: 0;font-weight: bold;">Focus on:</p><p>- Key patterns or trends</p><p>- Strengths and weaknesses</p><p>- Implications or recommendations</p><p>- Supporting evidence for your conclusions</p><p></p><p style="margin: 0;font-weight: bold;">Present your analysis in a structured format with clear reasoning.</p>`,

  categorise: `<p>Categorise the following content into relevant groups or themes:</p><p></p><p><span data-type="variable" data-id="step.00000000-0000-0000-0000-000000000000.Replace this with the content to categorise" data-label="Replace this with the content to categorise" data-value>{{step.00000000-0000-0000-0000-000000000000.Replace this with the content to categorise}}</span></p><p></p><p>Provide clear category labels and explain your reasoning for each grouping.</p>`,

  summarise: `<p>Summarise the following content, highlighting the key points and main takeaways:</p><p></p><p><span data-type="variable" data-id="step.00000000-0000-0000-0000-000000000000.Replace this with the content to summarise" data-label="Replace this with the content to summarise" data-value>{{step.00000000-0000-0000-0000-000000000000.Replace this with the content to summarise}}</span></p><p></p><p>Focus on the most important information and present it in a clear, concise format.</p>`,

  write: `<p>Write <span data-type="variable" data-id="step.00000000-0000-0000-0000-000000000000.Replace this with the content to write" data-label="Replace this with the content to write" data-value>{{step.00000000-0000-0000-0000-000000000000.Replace this with the content to write}}</span> based on the following requirements:</p><p></p><p><strong>Topic/Subject</strong>: [Specify topic]</p><p><strong>Purpose</strong>: [Explain the intended use]</p><p><strong>Audience</strong>: [Describe target audience]</p><p><strong>Tone</strong>: [Professional/Formal/Conversational]</p><p><strong>Length</strong>: [Specify word count or length]</p><p><strong>Additional requirements</strong>: [Any specific guidelines or constraints]</p>`,

  custom: `<p>Enter your custom prompt</p>`,
}

export const DEFAULT_RESPONSE_FIELDS_VALUES = {
  analyse: [
    {
      fieldName: 'key_patterns_or_trends',
      fieldType: 'text',
    },
    {
      fieldName: 'strengths_and_weaknesses',
      fieldType: 'text',
    },
    {
      fieldName: 'implications_or_recommendations',
      fieldType: 'text',
    },
    {
      fieldName: 'supporting_evidence_for_your_conclusions',
      fieldType: 'text',
    },
  ],
  categorise: [
    {
      fieldName: 'sentiment',
      fieldType: 'category',
      fieldCategories: 'Positive, Negative, Neutral',
    },
  ],
  summarise: [
    {
      fieldName: 'summary',
      fieldType: 'text',
    },
  ],
  write: [
    {
      fieldName: 'topic_subject',
      fieldType: 'text',
    },
    {
      fieldName: 'audience',
      fieldType: 'text',
    },
    {
      fieldName: 'tone',
      fieldType: 'category',
      fieldCategories: 'Professional, Conversational, Formal',
    },
    {
      fieldName: 'length',
      fieldType: 'number',
    },
  ],
  custom: [
    {
      fieldName: 'response',
      fieldType: 'text',
    },
  ],
}
