import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, PlayCircle } from 'lucide-react';
import { RecommendationResult } from '@/lib/recommendation/nextItem';

interface NextPracticeCardProps {
    recommendation: RecommendationResult;
    onStart: (item: any) => void;
    className?: string;
}

export function NextPracticeCard({ recommendation, onStart, className }: NextPracticeCardProps) {
    const { item, reason } = recommendation;

    return (
        <Card className={`border-primary/20 bg-primary/5 ${className}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary font-medium">
                    <Sparkles className="w-4 h-4" />
                    <span>下一条推荐练习</span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold">{item.title}</h3>
                            <Badge variant="outline" className="bg-background">
                                L{item.level}
                            </Badge>
                            {item.genre && (
                                <Badge variant="secondary" className="text-xs">
                                    {item.genre}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {reason}
                        </p>
                    </div>
                    <Button
                        onClick={() => onStart(item)}
                        className="shrink-0 md:w-auto w-full group"
                    >
                        <PlayCircle className="w-4 h-4 mr-2" />
                        开始练习
                        <ArrowRight className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
