// src/ai/flows/generate-cause-effect-question.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating cause-effect questions related to economic scenarios and fiscal policy responses.
 *
 * - generateCauseEffectQuestion - A function that generates a cause-effect question and answer choices.
 * - CauseEffectQuestionInput - The input type for the generateCauseEffectQuestion function.
 * - CauseEffectQuestionOutput - The return type for the generateCauseEffectQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CauseEffectQuestionInputSchema = z.object({
  economicCondition: z
    .string()
    .describe('The current economic condition, e.g., recessionary gap or inflationary gap.'),
});
export type CauseEffectQuestionInput = z.infer<typeof CauseEffectQuestionInputSchema>;

const CauseEffectQuestionOutputSchema = z.object({
  question: z.string().describe('The question about the economic scenario.'),
  choices: z.array(z.string()).describe('Four possible fiscal policy responses.'),
  correctAnswerIndex: z
    .number()
    .min(0)
    .max(3)
    .describe('The index (0-3) of the correct fiscal policy response in the choices array.'),
});
export type CauseEffectQuestionOutput = z.infer<typeof CauseEffectQuestionOutputSchema>;

export async function generateCauseEffectQuestion(
  input: CauseEffectQuestionInput
): Promise<CauseEffectQuestionOutput> {
  return causeEffectQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'causeEffectQuestionPrompt',
  input: {schema: CauseEffectQuestionInputSchema},
  output: {schema: CauseEffectQuestionOutputSchema},
  prompt: `You are an AP Macroeconomics question generator.  You will present the user with an economic condition and a multiple choice question regarding a fiscal policy that could be implemented to address it.  You will provide 4 possible answer choices, one of which is correct. Return the index of the correct answer, which should be 0, 1, 2, or 3. Ensure only one answer is correct and the remaining answers are plausible but incorrect. Do not explain the answers.

Economic Condition: {{{economicCondition}}}

Question: Which fiscal policy would be most effective in addressing the economic condition described above?

Choices:
{{#each choices}}
  - {{{this}}}
{{/each}}

Correct Answer Index: {{correctAnswerIndex}}`,
});

const causeEffectQuestionFlow = ai.defineFlow(
  {
    name: 'causeEffectQuestionFlow',
    inputSchema: CauseEffectQuestionInputSchema,
    outputSchema: CauseEffectQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt({
      ...input,
      choices: ['Increase government spending', 'Decrease taxes', 'Decrease government spending', 'Increase taxes'],
      correctAnswerIndex: 0, // Hardcoded example, to be replaced with AI-generated logic
    });
    return output!;
  }
);
