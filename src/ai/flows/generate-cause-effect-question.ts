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
  question: z.string().describe('The question about the economic scenario, which must clearly state the economic condition provided in the input.'),
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
  prompt: `You are an AP Macroeconomics question generator.
Your task is to create a multiple-choice question about the appropriate fiscal policy response to a given economic condition.
The economic condition is: {{{economicCondition}}}.

Generate a question that clearly states this economic condition. For example, if the input economicCondition is "recessionary gap", the generated question could be "Given a recessionary gap, which of the following fiscal policies would be most effective in addressing it?".
Provide four plausible fiscal policy responses as choices.
Indicate the index (0-3) of the single correct fiscal policy response in the choices array.
Ensure the other three choices are plausible but incorrect.
Do not provide explanations for the answers.

Example of desired output format for an input economicCondition of "inflationary gap":
Question: "Which fiscal policy is most appropriate for addressing an inflationary gap?"
Choices: ["Increase government spending and decrease taxes", "Decrease taxes and increase transfer payments", "Decrease government spending and increase taxes", "Increase the money supply by buying bonds"]
CorrectAnswerIndex: 2

Now, generate the question, choices, and correctAnswerIndex for the economic condition: {{{economicCondition}}}
Question:`,
});

const causeEffectQuestionFlow = ai.defineFlow(
  {
    name: 'causeEffectQuestionFlow',
    inputSchema: CauseEffectQuestionInputSchema,
    outputSchema: CauseEffectQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input); // Input only contains economicCondition
    // The AI is now responsible for generating the question, choices, and correctAnswerIndex.
    return output!;
  }
);

