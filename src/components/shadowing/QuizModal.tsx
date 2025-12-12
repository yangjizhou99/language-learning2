'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, ChevronRight } from 'lucide-react';

interface QuizQuestion {
    question: string;
    options: { A: string; B: string; C: string; D: string };
    answer: 'A' | 'B' | 'C' | 'D';
}

interface QuizAnswer {
    questionIndex: number;
    selected: 'A' | 'B' | 'C' | 'D';
    correct: boolean;
}

interface QuizModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    questions: QuizQuestion[];
    onComplete: (result: { answers: QuizAnswer[]; correctCount: number; total: number }) => void;
    lang?: 'ja' | 'en' | 'zh' | 'ko';
}

export default function QuizModal({ open, onOpenChange, questions, onComplete, lang = 'ja' }: QuizModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<QuizAnswer[]>([]);
    const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [completed, setCompleted] = useState(false);

    const currentQuestion = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;

    const handleSelectOption = (option: 'A' | 'B' | 'C' | 'D') => {
        if (showResult) return;
        setSelectedOption(option);
    };

    const handleConfirm = () => {
        if (!selectedOption || !currentQuestion) return;

        const isCorrect = selectedOption === currentQuestion.answer;
        const newAnswer: QuizAnswer = {
            questionIndex: currentIndex,
            selected: selectedOption,
            correct: isCorrect,
        };

        setAnswers([...answers, newAnswer]);
        setShowResult(true);
    };

    const handleNext = () => {
        if (isLastQuestion) {
            // Complete quiz
            const finalAnswers = [...answers];
            const correctCount = finalAnswers.filter(a => a.correct).length;
            setCompleted(true);
            onComplete({
                answers: finalAnswers,
                correctCount,
                total: questions.length,
            });
        } else {
            // Move to next question
            setCurrentIndex(currentIndex + 1);
            setSelectedOption(null);
            setShowResult(false);
        }
    };

    const handleClose = () => {
        // Reset state when closing
        setCurrentIndex(0);
        setAnswers([]);
        setSelectedOption(null);
        setShowResult(false);
        setCompleted(false);
        onOpenChange(false);
    };

    if (!questions || questions.length === 0) {
        return null;
    }

    const correctCount = answers.filter(a => a.correct).length;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>理解力测试</span>
                        <span className="text-sm font-normal text-muted-foreground">
                            {currentIndex + 1} / {questions.length}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {completed ? (
                    // Result summary
                    <div className="space-y-4 py-4">
                        <div className="text-center">
                            <div className="text-4xl font-bold mb-2">
                                {correctCount} / {questions.length}
                            </div>
                            <p className="text-muted-foreground">
                                {correctCount === questions.length
                                    ? '全部正确！🎉'
                                    : correctCount > 0
                                        ? '继续加油！💪'
                                        : '再听一遍试试 👂'}
                            </p>
                        </div>
                        <Button onClick={handleClose} className="w-full">
                            继续练习
                        </Button>
                    </div>
                ) : (
                    // Question view
                    <div className="space-y-4">
                        {/* Question */}
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-lg font-medium">{currentQuestion?.question}</p>
                            </CardContent>
                        </Card>

                        {/* Options */}
                        <div className="space-y-2">
                            {(['A', 'B', 'C', 'D'] as const).map((key) => {
                                const isSelected = selectedOption === key;
                                const isCorrect = currentQuestion?.answer === key;
                                const showCorrectHighlight = showResult && isCorrect;
                                const showWrongHighlight = showResult && isSelected && !isCorrect;

                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleSelectOption(key)}
                                        disabled={showResult}
                                        className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${showCorrectHighlight
                                                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                                                : showWrongHighlight
                                                    ? 'border-red-500 bg-red-50 dark:bg-red-950'
                                                    : isSelected
                                                        ? 'border-primary bg-primary/10'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                                            }`}
                                    >
                                        <span
                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${showCorrectHighlight
                                                    ? 'bg-green-500 text-white'
                                                    : showWrongHighlight
                                                        ? 'bg-red-500 text-white'
                                                        : isSelected
                                                            ? 'bg-primary text-white'
                                                            : 'bg-gray-100 dark:bg-gray-800'
                                                }`}
                                        >
                                            {showCorrectHighlight ? (
                                                <CheckCircle className="w-4 h-4" />
                                            ) : showWrongHighlight ? (
                                                <XCircle className="w-4 h-4" />
                                            ) : (
                                                key
                                            )}
                                        </span>
                                        <span className="flex-1">{currentQuestion?.options[key]}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            {!showResult ? (
                                <Button
                                    onClick={handleConfirm}
                                    disabled={!selectedOption}
                                    className="w-full"
                                >
                                    确认
                                </Button>
                            ) : (
                                <Button onClick={handleNext} className="w-full">
                                    {isLastQuestion ? '查看结果' : '下一题'}
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
