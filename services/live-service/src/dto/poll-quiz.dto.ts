import { IsString, IsArray, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class CreatePollDto {
  @IsString()
  sessionId: string;

  @IsString()
  question: string;

  @IsArray()
  options: Array<{
    id: string;
    text: string;
  }>;

  @IsOptional()
  @IsBoolean()
  isMultipleChoice?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean = true;

  @IsOptional()
  @IsNumber()
  duration?: number;
}

export class CreateQuizDto {
  @IsString()
  sessionId: string;

  @IsString()
  title: string;

  @IsArray()
  questions: Array<{
    id: string;
    question: string;
    type: 'multiple-choice' | 'true-false' | 'short-answer';
    options?: Array<{ id: string; text: string; isCorrect: boolean }>;
    correctAnswer?: string;
    points: number;
  }>;

  @IsOptional()
  @IsNumber()
  timeLimit?: number;
}

export class SubmitQuizAnswerDto {
  @IsString()
  quizId: string;

  @IsArray()
  answers: Array<{
    questionId: string;
    answer: string | string[];
  }>;
}