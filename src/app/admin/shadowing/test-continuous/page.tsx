'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export default function TestContinuousPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Theme Generation State
    const [generatingThemes, setGeneratingThemes] = useState(false);
    const [generatedThemes, setGeneratedThemes] = useState<any[]>([]);
    const [selectedThemeIndex, setSelectedThemeIndex] = useState<number | null>(null);
    const [themeCount, setThemeCount] = useState(10);

    const [formData, setFormData] = useState({
        theme_title: '',
        lang: 'en',
        level: 2,
        genre: 'dialogue',
        count: 5,
        // dialogue_type removed
        provider: 'deepseek',
        model: 'deepseek-chat',
        temperature: 0.7,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleGenerateThemes = async () => {
        setGeneratingThemes(true);
        setError(null);
        setGeneratedThemes([]);
        setSelectedThemeIndex(null);

        try {
            // Step 1: Generate Themes (Batch)
            const res = await fetch('/api/admin/shadowing/themes/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    step: 'themes_only',
                    lang: formData.lang,
                    level: Number(formData.level),
                    genre: formData.genre,
                    count: themeCount,
                    provider: formData.provider,
                    model: formData.model,
                    temperature: formData.temperature,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Theme generation failed');

            const themes = data.themes || data.inserted_themes || [];
            setGeneratedThemes(themes);

            // Step 2: Generate Scripts (Individual)
            for (let i = 0; i < themes.length; i++) {
                const theme = themes[i];
                try {
                    // Update UI to show loading for this theme (optional, can be improved)
                    setGeneratedThemes(prev => {
                        const newThemes = [...prev];
                        newThemes[i] = { ...newThemes[i], loadingScript: true };
                        return newThemes;
                    });

                    const scriptRes = await fetch('/api/admin/shadowing/themes/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            step: 'script_only',
                            lang: formData.lang,
                            level: Number(formData.level),
                            genre: formData.genre,
                            theme: theme,
                            provider: formData.provider,
                            model: formData.model,
                            temperature: formData.temperature,
                        }),
                    });

                    const scriptData = await scriptRes.json();
                    if (!scriptRes.ok) throw new Error(scriptData.error || 'Script generation failed');

                    // Update theme with script and recommended_count
                    setGeneratedThemes(prev => {
                        const newThemes = [...prev];
                        newThemes[i] = {
                            ...newThemes[i],
                            script: scriptData.script,
                            recommended_count: scriptData.recommended_count,
                            loadingScript: false
                        };
                        return newThemes;
                    });

                } catch (err) {
                    console.error(`Failed to generate script for theme ${i}`, err);
                    setGeneratedThemes(prev => {
                        const newThemes = [...prev];
                        newThemes[i] = { ...newThemes[i], loadingScript: false, scriptError: true };
                        return newThemes;
                    });
                }
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setGeneratingThemes(false);
        }
    };

    const selectTheme = (index: number) => {
        setSelectedThemeIndex(index);
        setFormData(prev => ({ ...prev, theme_title: generatedThemes[index].title }));
    };

    const handleGenerate = async () => {
        if (!formData.theme_title) {
            setError("Please select a theme or enter a theme title first.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch('/api/admin/shadowing/subtopics/generate-continuous', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    theme_script: selectedThemeIndex !== null ? generatedThemes[selectedThemeIndex]?.script : undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Generation failed');
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const [generatingContent, setGeneratingContent] = useState<Record<number, boolean>>({});
    const [generatedContent, setGeneratedContent] = useState<Record<number, any>>({});

    const handleGenerateContent = async (index: number, subtopic: any) => {
        setGeneratingContent((prev) => ({ ...prev, [index]: true }));
        try {
            // Prepare subtopic data with necessary fields
            const subtopicData = {
                ...subtopic,
                lang: formData.lang,
                level: formData.level,
                genre: formData.genre,
                // dialogue_type is now in subtopic if generated
            };

            const res = await fetch('/api/admin/shadowing/content/generate-preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subtopic: subtopicData,
                    provider: formData.provider,
                    model: formData.model,
                    temperature: formData.temperature,
                    theme_script: selectedThemeIndex !== null ? generatedThemes[selectedThemeIndex]?.script : undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Content generation failed');
            }

            setGeneratedContent((prev) => ({ ...prev, [index]: data.data }));
        } catch (err: any) {
            alert('Error generating content: ' + err.message);
        } finally {
            setGeneratingContent((prev) => ({ ...prev, [index]: false }));
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Test Continuous Story Generation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Configuration Section */}
                    <div className="grid grid-cols-2 gap-4 border-b pb-6">
                        <div className="space-y-2">
                            <Label htmlFor="lang">Language</Label>
                            <select
                                id="lang"
                                name="lang"
                                value={formData.lang}
                                onChange={handleChange}
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="en">English</option>
                                <option value="ja">Japanese</option>
                                <option value="zh">Chinese</option>
                                <option value="ko">Korean</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="level">Level</Label>
                            <select
                                id="level"
                                name="level"
                                value={formData.level}
                                onChange={handleChange}
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {[1, 2, 3, 4, 5, 6].map((l) => (
                                    <option key={l} value={l}>L{l}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="genre">Genre</Label>
                            <select
                                id="genre"
                                name="genre"
                                value={formData.genre}
                                onChange={handleChange}
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="dialogue">Dialogue</option>
                                <option value="monologue">Monologue</option>
                                <option value="news">News</option>
                                <option value="lecture">Lecture</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="provider">AI Provider</Label>
                            <select
                                id="provider"
                                name="provider"
                                value={formData.provider}
                                onChange={handleChange}
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="deepseek">DeepSeek</option>
                                <option value="openrouter">OpenRouter</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="model">Model</Label>
                            <Input
                                id="model"
                                name="model"
                                value={formData.model}
                                onChange={handleChange}
                                placeholder="e.g. deepseek-chat"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="temperature">Temperature</Label>
                            <Input
                                id="temperature"
                                name="temperature"
                                type="number"
                                step="0.1"
                                min="0"
                                max="2"
                                value={formData.temperature}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* Step 1: Generate Theme */}
                    <div className="space-y-4 border-b pb-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Step 1: Generate Theme</h3>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="themeCount" className="whitespace-nowrap">Count:</Label>
                                <Input
                                    id="themeCount"
                                    type="number"
                                    value={themeCount}
                                    onChange={(e) => setThemeCount(Number(e.target.value))}
                                    className="w-20"
                                    min={1}
                                    max={20}
                                />
                            </div>
                        </div>
                        <Button onClick={handleGenerateThemes} disabled={generatingThemes} variant="secondary" className="w-full">
                            {generatingThemes ? 'Generating Themes...' : 'Generate Themes'}
                        </Button>

                        {generatedThemes.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                {generatedThemes.map((theme, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-4 border rounded cursor-pointer hover:bg-slate-50 ${selectedThemeIndex === idx ? 'ring-2 ring-primary border-primary bg-slate-50' : ''}`}
                                        onClick={() => {
                                            selectTheme(idx);
                                            // Pre-fill count if recommended_count is available
                                            if (theme.recommended_count) {
                                                setFormData(prev => ({ ...prev, count: theme.recommended_count }));
                                            }
                                        }}
                                    >
                                        <h4 className="font-bold">{theme.title}</h4>
                                        <p className="text-sm text-gray-500 mt-2">{theme.desc || theme.rationale}</p>

                                        {theme.loadingScript && (
                                            <div className="mt-2 p-2 bg-gray-50 text-xs text-gray-500 rounded border border-gray-200 animate-pulse">
                                                Generating detailed script...
                                            </div>
                                        )}

                                        {theme.script && (
                                            <div className="mt-2 p-2 bg-yellow-50 text-xs text-gray-700 rounded border border-yellow-100">
                                                <strong>Script:</strong> {theme.script}
                                            </div>
                                        )}
                                        {theme.recommended_count && (
                                            <div className="mt-2 p-2 bg-blue-50 text-xs text-blue-700 rounded border border-blue-100">
                                                <strong>Recommended Chapters:</strong> {theme.recommended_count}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Step 2: Generate Subtopics */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Step 2: Generate Continuous Story</h3>
                        <div className="space-y-2">
                            <Label htmlFor="theme_title">Theme Title (Selected or Custom)</Label>
                            <Input
                                id="theme_title"
                                name="theme_title"
                                value={formData.theme_title}
                                onChange={handleChange}
                                placeholder="e.g. Campus Life"
                            />
                        </div>
                        {selectedThemeIndex !== null && generatedThemes[selectedThemeIndex]?.script && (
                            <div className="space-y-2">
                                <Label>Theme Script (Auto-filled)</Label>
                                <div className="p-3 bg-slate-50 border rounded text-sm text-gray-700">
                                    {generatedThemes[selectedThemeIndex].script}
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="count">Subtopic Count</Label>
                            <Input
                                id="count"
                                name="count"
                                type="number"
                                value={formData.count}
                                onChange={handleChange}
                            />
                        </div>

                        <Button onClick={handleGenerate} disabled={loading} className="w-full">
                            {loading ? 'Generating Story...' : 'Generate Continuous Story'}
                        </Button>
                    </div>

                    {error && (
                        <div className="p-4 text-red-500 bg-red-50 rounded-md">
                            Error: {error}
                        </div>
                    )}
                </CardContent>
            </Card>

            {result && (
                <Card>
                    <CardHeader>
                        <CardTitle>Generated Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {result.generated_subtopics.map((subtopic: any, index: number) => (
                                <div key={index} className="border p-4 rounded-md space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-bold text-lg">
                                                {index + 1}. {subtopic.title}
                                            </h3>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleGenerateContent(index, subtopic)}
                                                disabled={generatingContent[index]}
                                            >
                                                {generatingContent[index] ? 'Generating...' : 'Generate Content'}
                                            </Button>
                                        </div>
                                        <p className="text-sm text-gray-500">Seed: {subtopic.seed}</p>
                                        <p className="text-gray-700">{subtopic.one_line}</p>

                                        {/* Display Dialogue Type and Roles if available */}
                                        {subtopic.dialogue_type && (
                                            <p className="text-sm"><span className="font-semibold">Type:</span> {subtopic.dialogue_type}</p>
                                        )}
                                        {subtopic.roles && (
                                            <div className="text-sm bg-slate-50 p-2 rounded">
                                                <p><span className="font-semibold">Protagonist:</span> {subtopic.roles.protagonist}</p>
                                                <p><span className="font-semibold">Other:</span> {subtopic.roles.other}</p>
                                            </div>
                                        )}
                                    </div>

                                    {generatedContent[index] && (
                                        <div className="bg-slate-50 p-4 rounded-md border mt-4">
                                            <h4 className="font-semibold mb-2">{generatedContent[index].title}</h4>
                                            <div className="whitespace-pre-wrap text-sm font-mono bg-white p-3 rounded border">
                                                {generatedContent[index].passage}
                                            </div>
                                            {generatedContent[index].notes && (
                                                <div className="mt-2 text-xs text-gray-500">
                                                    {/* Notes are now empty by default */}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-6">
                            <h4 className="font-semibold mb-2">Raw JSON:</h4>
                            <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-xs">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
