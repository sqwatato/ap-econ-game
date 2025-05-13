// src/ai/flows/generate-economics-question.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating AP Macroeconomics trivia questions.
 *
 * - generateEconomicsQuestion - A function that generates a multiple-choice question about AP Macroeconomics.
 * - EconomicsQuestionInput - The input type for the generateEconomicsQuestion function.
 * - EconomicsQuestionOutput - The return type for the generateEconomicsQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EconomicsQuestionInputSchema = z.object({
  topic: z.string().describe('The specific AP Macroeconomics topic to generate a question about.'),
});
export type EconomicsQuestionInput = z.infer<typeof EconomicsQuestionInputSchema>;

const EconomicsQuestionOutputSchema = z.object({
  question: z.string().describe('The multiple-choice question about AP Macroeconomics.'),
  choices: z.array(z.string()).describe('An array of four possible answer choices.'),
  correctAnswerIndex: z
    .number()
    .min(0)
    .max(3)
    .describe('The index of the correct answer in the choices array.'),
  explanation: z.string().describe('Explanation of the correct answer.'),
});
export type EconomicsQuestionOutput = z.infer<typeof EconomicsQuestionOutputSchema>;

export async function generateEconomicsQuestion(input: EconomicsQuestionInput): Promise<EconomicsQuestionOutput> {
  return generateEconomicsQuestionFlow(input);
}

const generateEconomicsQuestionPrompt = ai.definePrompt({
  name: 'generateEconomicsQuestionPrompt',
  input: {schema: EconomicsQuestionInputSchema},
  output: {schema: EconomicsQuestionOutputSchema},
  prompt: `You are an AP Macroeconomics question generator. Generate a multiple-choice question on the topic of {{{topic}}}. Provide four answer choices, only one of which is correct. Indicate the index of the correct answer in the choices array (0, 1, 2, or 3). Also, provide a short explanation of the correct answer.

Example:
Topic: Fiscal Policy
Question: Which of the following is an example of expansionary fiscal policy?
Choices: ["Increasing government spending", "Increasing taxes", "Decreasing the money supply", "Raising interest rates"]
CorrectAnswerIndex: 0
Explanation: Increasing government spending is an example of expansionary fiscal policy, which aims to stimulate economic growth during a recession.

Topic: {{{topic}}}
Question:`, 
});

const generateEconomicsQuestionFlow = ai.defineFlow(
  {
    name: 'generateEconomicsQuestionFlow',
    inputSchema: EconomicsQuestionInputSchema,
    outputSchema: EconomicsQuestionOutputSchema,
  },
  async input => {
    const {output} = await generateEconomicsQuestionPrompt(input);
    return output!;
  }
);
