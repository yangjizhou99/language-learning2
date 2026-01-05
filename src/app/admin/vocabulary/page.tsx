'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

// Types
interface LLMVocabItem {
    word: string;
    level: string;
    reading?: string;
    definition?: string;
    source?: string;
    createdAt?: string;
}

interface FrequencyItem {
    word: string;
    rank: number;
    source: 'main' | 'patch';
}

interface StaticDictItem {
    word: string;
    level: string;
}

interface ArticleLexProfileItem {
    id: string;
    title: string;
    text: string;
    fullText?: string;
    lang: string;
    level: number;
    genre: string;
    status: string;
    createdAt: string;
    hasLexProfile?: boolean;
    lexProfile: {
        A1_A2: number;
        B1_B2: number;
        C1_plus: number;
        unknown: number;
        contentWordCount: number;
        totalTokens: number;
    };
    stats: {
        totalContentWords: number;
        a1a2Percent: number;
        b1b2Percent: number;
        c1PlusPercent: number;
        unknownPercent: number;
    };
}

interface ArticleDetailWord {
    word: string;
    lemma: string;
    pos: string;
    level: string;
    broadCEFR: string;
    frequencyRank: number;
    frequencyLabel: string;
    knownProbability: number;
}

type DataType = 'llm-vocab' | 'frequency' | 'static-dict' | 'article-lex-profile';

const LEVEL_OPTIONS = ['N1', 'N2', 'N3', 'N4', 'N5'];
const CEFR_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const HSK_OPTIONS = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];

const DICT_OPTIONS = [
    { value: 'ja-jlpt', label: 'Japanese JLPT (Default)' },
    { value: 'ja-jlpt-combined', label: 'Japanese JLPT (Combined)' },
    { value: 'ja-jlpt-elzup', label: 'Japanese JLPT (Elzup)' },
    { value: 'ja-jlpt-tanos', label: 'Japanese JLPT (Tanos)' },
    { value: 'en-cefr', label: 'English CEFR' },
    { value: 'zh-hsk', label: 'Chinese HSK' },
];

export default function VocabularyAdminPage() {
    // Current tab
    const [activeTab, setActiveTab] = useState<DataType>('llm-vocab');

    // Common state
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [levelFilter, setLevelFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalPages, setTotalPages] = useState(0);
    const [total, setTotal] = useState(0);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // LLM Vocab state
    const [llmVocabItems, setLlmVocabItems] = useState<LLMVocabItem[]>([]);

    // Frequency state
    const [frequencyItems, setFrequencyItems] = useState<FrequencyItem[]>([]);

    // Static dict state
    const [staticDictItems, setStaticDictItems] = useState<StaticDictItem[]>([]);
    const [selectedDict, setSelectedDict] = useState('ja-jlpt');

    // Article lex profile state
    const [articleItems, setArticleItems] = useState<ArticleLexProfileItem[]>([]);
    const [langFilter, setLangFilter] = useState('');

    // Article detail dialog
    const [articleDetailOpen, setArticleDetailOpen] = useState(false);
    const [articleDetailLoading, setArticleDetailLoading] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState<ArticleLexProfileItem | null>(null);
    const [articleWords, setArticleWords] = useState<ArticleDetailWord[]>([]);

    // Edit dialog
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editItem, setEditItem] = useState<LLMVocabItem | FrequencyItem | StaticDictItem | null>(null);
    const [editForm, setEditForm] = useState({
        word: '',
        level: '',
        reading: '',
        definition: '',
        rank: 0,
    });

    // Add dialog
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        word: '',
        level: 'N3',
        reading: '',
        definition: '',
        rank: 1000,
    });

    // Determine level options based on current dict
    const currentLevelOptions = useMemo(() => {
        if (activeTab === 'static-dict') {
            if (selectedDict.includes('cefr')) return CEFR_OPTIONS;
            if (selectedDict.includes('hsk')) return HSK_OPTIONS;
        }
        return LEVEL_OPTIONS;
    }, [activeTab, selectedDict]);

    // Fetch data
    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const params = new URLSearchParams({
                type: activeTab,
                page: page.toString(),
                pageSize: pageSize.toString(),
            });

            if (search) params.set('search', search);
            if (levelFilter && levelFilter !== 'all') params.set('level', levelFilter);
            if (activeTab === 'static-dict') params.set('dict', selectedDict);
            if (activeTab === 'article-lex-profile') {
                params.set('includeAll', 'true'); // Show all articles, even unanalyzed ones
                if (langFilter && langFilter !== 'all') {
                    params.set('lang', langFilter);
                }
            }

            const response = await fetch(`/api/admin/vocabulary?${params}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch data');
            }

            setTotal(data.total);
            setTotalPages(data.totalPages);

            if (activeTab === 'llm-vocab') {
                setLlmVocabItems(data.items);
            } else if (activeTab === 'frequency') {
                setFrequencyItems(data.items);
            } else if (activeTab === 'static-dict') {
                setStaticDictItems(data.items);
            } else if (activeTab === 'article-lex-profile') {
                setArticleItems(data.items);
            }

        } catch (error) {
            console.error('Fetch error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setSelected(new Set());
    }, [activeTab, page, pageSize, search, levelFilter, selectedDict, langFilter]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [search, levelFilter, activeTab, selectedDict, langFilter]);

    // Open article detail
    const openArticleDetail = async (article: ArticleLexProfileItem) => {
        setSelectedArticle(article);
        setArticleDetailOpen(true);
        setArticleDetailLoading(true);
        setArticleWords([]);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(`/api/admin/vocabulary/article-detail?id=${article.id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch article detail');
            }

            setArticleWords(data.words || []);
        } catch (error) {
            console.error('Article detail error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load article detail');
        } finally {
            setArticleDetailLoading(false);
        }
    };

    // Toggle select
    const toggleSelect = (word: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(word)) {
                next.delete(word);
            } else {
                next.add(word);
            }
            return next;
        });
    };

    // Select all on current page
    const toggleSelectAll = () => {
        const currentItems = activeTab === 'llm-vocab' ? llmVocabItems :
            activeTab === 'frequency' ? frequencyItems : staticDictItems;
        const allSelected = currentItems.every(item => selected.has(item.word));

        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(currentItems.map(item => item.word)));
        }
    };

    // Open edit dialog
    const openEditDialog = (item: LLMVocabItem | FrequencyItem | StaticDictItem) => {
        setEditItem(item);
        setEditForm({
            word: item.word,
            level: 'level' in item ? item.level : '',
            reading: 'reading' in item && item.reading ? item.reading : '',
            definition: 'definition' in item && item.definition ? item.definition : '',
            rank: 'rank' in item ? item.rank : 0,
        });
        setEditDialogOpen(true);
    };

    // Save edit
    const saveEdit = async () => {
        if (!editItem) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const body: any = {
                type: activeTab,
                word: editForm.word,
            };

            if (activeTab === 'llm-vocab') {
                body.level = editForm.level;
                body.reading = editForm.reading;
                body.definition = editForm.definition;
            } else if (activeTab === 'frequency') {
                body.rank = editForm.rank;
            } else if (activeTab === 'static-dict') {
                body.level = editForm.level;
                body.dictName = selectedDict;
            }

            const response = await fetch('/api/admin/vocabulary', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update');
            }

            toast.success(`Updated "${editForm.word}"`);
            setEditDialogOpen(false);
            fetchData();

        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Update failed');
        }
    };

    // Delete selected
    const deleteSelected = async () => {
        if (selected.size === 0) return;

        const confirmed = window.confirm(`Delete ${selected.size} entries?`);
        if (!confirmed) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const body: any = {
                type: activeTab,
                words: Array.from(selected),
            };

            if (activeTab === 'static-dict') {
                body.dictName = selectedDict;
            }

            const response = await fetch('/api/admin/vocabulary', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete');
            }

            toast.success(`Deleted ${data.deletedCount} entries`);
            setSelected(new Set());
            fetchData();

        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Delete failed');
        }
    };

    // Add new entry
    const addEntry = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const body: any = {
                type: activeTab,
                word: addForm.word,
            };

            if (activeTab === 'llm-vocab') {
                body.level = addForm.level;
                body.reading = addForm.reading;
                body.definition = addForm.definition;
            } else if (activeTab === 'frequency') {
                body.rank = addForm.rank;
            } else if (activeTab === 'static-dict') {
                body.level = addForm.level;
                body.dictName = selectedDict;
            }

            const response = await fetch('/api/admin/vocabulary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to add');
            }

            toast.success(`Added "${addForm.word}"`);
            setAddDialogOpen(false);
            setAddForm({ word: '', level: 'N3', reading: '', definition: '', rank: 1000 });
            fetchData();

        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Add failed');
        }
    };

    // Get level badge color
    const getLevelColor = (level: string) => {
        if (level.includes('N1') || level.includes('C2') || level.includes('HSK6')) return 'bg-red-100 text-red-800';
        if (level.includes('N2') || level.includes('C1') || level.includes('HSK5')) return 'bg-orange-100 text-orange-800';
        if (level.includes('N3') || level.includes('B2') || level.includes('HSK4')) return 'bg-yellow-100 text-yellow-800';
        if (level.includes('N4') || level.includes('B1') || level.includes('HSK3')) return 'bg-green-100 text-green-800';
        if (level.includes('N5') || level.includes('A2') || level.includes('HSK2')) return 'bg-blue-100 text-blue-800';
        return 'bg-gray-100 text-gray-800';
    };

    // Get frequency rank color
    const getRankColor = (rank: number) => {
        if (rank <= 1000) return 'bg-green-100 text-green-800';
        if (rank <= 5000) return 'bg-yellow-100 text-yellow-800';
        if (rank <= 10000) return 'bg-orange-100 text-orange-800';
        return 'bg-red-100 text-red-800';
    };

    // Get frequency color by rank
    const getFrequencyColor = (rank: number) => {
        if (rank === -1) return 'bg-gray-100 text-gray-800';
        if (rank <= 1000) return 'bg-green-100 text-green-800';
        if (rank <= 5000) return 'bg-yellow-100 text-yellow-800';
        if (rank <= 10000) return 'bg-orange-100 text-orange-800';
        return 'bg-red-100 text-red-800';
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">词汇管理</h1>
                    <p className="text-muted-foreground">管理词汇等级和词频数据</p>
                </div>
                <Link href="/admin/shadowing/review">
                    <Button variant="outline">返回跟读审核</Button>
                </Link>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DataType)}>
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="llm-vocab">LLM词汇规则</TabsTrigger>
                    <TabsTrigger value="frequency">词频数据</TabsTrigger>
                    <TabsTrigger value="static-dict">静态词典</TabsTrigger>
                    <TabsTrigger value="article-lex-profile">文章等级分析</TabsTrigger>
                </TabsList>

                {/* Filters Bar */}
                <Card className="mt-4">
                    <CardContent className="pt-4">
                        <div className="flex flex-wrap gap-4 items-center">
                            {/* Search */}
                            <div className="flex-1 min-w-[200px]">
                                <Input
                                    placeholder="搜索词条..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Level filter (for vocab tabs) */}
                            {activeTab !== 'frequency' && activeTab !== 'article-lex-profile' && (
                                <Select value={levelFilter} onValueChange={setLevelFilter}>
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="等级筛选" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部等级</SelectItem>
                                        {currentLevelOptions.map(l => (
                                            <SelectItem key={l} value={l}>{l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* Language filter (for article-lex-profile) */}
                            {activeTab === 'article-lex-profile' && (
                                <Select value={langFilter} onValueChange={setLangFilter}>
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="语言筛选" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部语言</SelectItem>
                                        <SelectItem value="ja">日语 (JA)</SelectItem>
                                        <SelectItem value="zh">中文 (ZH)</SelectItem>
                                        <SelectItem value="en">英语 (EN)</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}

                            {/* Dictionary selector (for static-dict) */}
                            {activeTab === 'static-dict' && (
                                <Select value={selectedDict} onValueChange={setSelectedDict}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DICT_OPTIONS.map(d => (
                                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* Page size */}
                            <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="25">25条</SelectItem>
                                    <SelectItem value="50">50条</SelectItem>
                                    <SelectItem value="100">100条</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Actions */}
                            {activeTab !== 'article-lex-profile' && (
                                <Button onClick={() => setAddDialogOpen(true)}>
                                    添加词条
                                </Button>
                            )}
                            {selected.size > 0 && activeTab !== 'article-lex-profile' && (
                                <Button variant="destructive" onClick={deleteSelected}>
                                    删除 ({selected.size})
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Stats */}
                <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>共 {total.toLocaleString()} 条</span>
                    <span>第 {page}/{totalPages} 页</span>
                    {selected.size > 0 && <span className="text-primary">已选择 {selected.size} 条</span>}
                </div>

                {/* LLM Vocab Tab */}
                <TabsContent value="llm-vocab" className="mt-4">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={llmVocabItems.length > 0 && llmVocabItems.every(i => selected.has(i.word))}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>词条</TableHead>
                                    <TableHead>读音</TableHead>
                                    <TableHead>等级</TableHead>
                                    <TableHead>定义</TableHead>
                                    <TableHead>来源</TableHead>
                                    <TableHead className="w-[100px]">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">
                                            加载中...
                                        </TableCell>
                                    </TableRow>
                                ) : llmVocabItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            暂无数据
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    llmVocabItems.map((item) => (
                                        <TableRow key={item.word}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selected.has(item.word)}
                                                    onCheckedChange={() => toggleSelect(item.word)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{item.word}</TableCell>
                                            <TableCell className="text-muted-foreground">{item.reading || '-'}</TableCell>
                                            <TableCell>
                                                <Badge className={getLevelColor(item.level)}>{item.level}</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[300px] truncate">{item.definition || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{item.source || 'llm'}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
                                                    编辑
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* Frequency Tab */}
                <TabsContent value="frequency" className="mt-4">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={frequencyItems.length > 0 && frequencyItems.every(i => selected.has(i.word))}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>词条</TableHead>
                                    <TableHead>词频排名</TableHead>
                                    <TableHead>频率等级</TableHead>
                                    <TableHead>来源</TableHead>
                                    <TableHead className="w-[100px]">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            加载中...
                                        </TableCell>
                                    </TableRow>
                                ) : frequencyItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            暂无数据
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    frequencyItems.map((item) => (
                                        <TableRow key={item.word}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selected.has(item.word)}
                                                    onCheckedChange={() => toggleSelect(item.word)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{item.word}</TableCell>
                                            <TableCell>{item.rank.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge className={getRankColor(item.rank)}>
                                                    {item.rank <= 1000 ? '常用' :
                                                        item.rank <= 5000 ? '较常用' :
                                                            item.rank <= 10000 ? '不常用' : '罕见'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={item.source === 'patch' ? 'default' : 'outline'}>
                                                    {item.source === 'patch' ? '自定义' : '主列表'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
                                                    编辑
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* Static Dict Tab */}
                <TabsContent value="static-dict" className="mt-4">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={staticDictItems.length > 0 && staticDictItems.every(i => selected.has(i.word))}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>词条</TableHead>
                                    <TableHead>等级</TableHead>
                                    <TableHead className="w-[100px]">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">
                                            加载中...
                                        </TableCell>
                                    </TableRow>
                                ) : staticDictItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            暂无数据
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    staticDictItems.map((item) => (
                                        <TableRow key={item.word}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selected.has(item.word)}
                                                    onCheckedChange={() => toggleSelect(item.word)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{item.word}</TableCell>
                                            <TableCell>
                                                <Badge className={getLevelColor(item.level)}>{item.level}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
                                                    编辑
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* Article Lex Profile Tab */}
                <TabsContent value="article-lex-profile" className="mt-4">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>标题</TableHead>
                                    <TableHead>语言</TableHead>
                                    <TableHead>状态</TableHead>
                                    <TableHead className="text-center">A1/A2</TableHead>
                                    <TableHead className="text-center">B1/B2</TableHead>
                                    <TableHead className="text-center">C1+</TableHead>
                                    <TableHead className="text-center">未知</TableHead>
                                    <TableHead className="text-center">内容词</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8">
                                            加载中...
                                        </TableCell>
                                    </TableRow>
                                ) : articleItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            暂无已分析的文章。请先通过"跟读审核"页面对文章进行词汇等级分析。
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    articleItems.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="max-w-[200px]">
                                                <div
                                                    className="font-medium truncate cursor-pointer hover:text-blue-600 hover:underline"
                                                    onClick={() => openArticleDetail(item)}
                                                >
                                                    {item.title}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate">{item.text}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{item.lang?.toUpperCase() || 'JA'}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {item.hasLexProfile ? (
                                                    <Badge variant={item.status === 'published' ? 'default' : 'secondary'}>
                                                        {item.status}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">未分析</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {item.hasLexProfile ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-medium text-blue-600">{item.stats.a1a2Percent}%</span>
                                                        <span className="text-xs text-muted-foreground">{item.lexProfile.A1_A2}</span>
                                                    </div>
                                                ) : <span className="text-muted-foreground">-</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {item.hasLexProfile ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-medium text-green-600">{item.stats.b1b2Percent}%</span>
                                                        <span className="text-xs text-muted-foreground">{item.lexProfile.B1_B2}</span>
                                                    </div>
                                                ) : <span className="text-muted-foreground">-</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {item.hasLexProfile ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-medium text-orange-600">{item.stats.c1PlusPercent}%</span>
                                                        <span className="text-xs text-muted-foreground">{item.lexProfile.C1_plus}</span>
                                                    </div>
                                                ) : <span className="text-muted-foreground">-</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {item.hasLexProfile ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="font-medium text-red-600">{item.stats.unknownPercent}%</span>
                                                        <span className="text-xs text-muted-foreground">{item.lexProfile.unknown}</span>
                                                    </div>
                                                ) : <span className="text-muted-foreground">-</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {item.hasLexProfile ? (
                                                    <span className="font-medium">{item.stats.totalContentWords}</span>
                                                ) : <span className="text-muted-foreground">-</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openArticleDetail(item)}
                                                >
                                                    {item.hasLexProfile ? '查看详情' : '分析词汇'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Pagination */}
            <div className="flex justify-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                >
                    首页
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                >
                    上一页
                </Button>
                <span className="flex items-center px-4 text-sm">
                    {page} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                >
                    下一页
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                >
                    末页
                </Button>
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>编辑词条</DialogTitle>
                        <DialogDescription>修改词条信息</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>词条</Label>
                            <Input value={editForm.word} disabled />
                        </div>

                        {activeTab === 'frequency' ? (
                            <div className="grid gap-2">
                                <Label>词频排名</Label>
                                <Input
                                    type="number"
                                    value={editForm.rank}
                                    onChange={(e) => setEditForm(f => ({ ...f, rank: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-2">
                                    <Label>等级</Label>
                                    <Select value={editForm.level} onValueChange={(v) => setEditForm(f => ({ ...f, level: v }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currentLevelOptions.map(l => (
                                                <SelectItem key={l} value={l}>{l}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {activeTab === 'llm-vocab' && (
                                    <>
                                        <div className="grid gap-2">
                                            <Label>读音</Label>
                                            <Input
                                                value={editForm.reading}
                                                onChange={(e) => setEditForm(f => ({ ...f, reading: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>定义</Label>
                                            <Input
                                                value={editForm.definition}
                                                onChange={(e) => setEditForm(f => ({ ...f, definition: e.target.value }))}
                                            />
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
                        <Button onClick={saveEdit}>保存</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>添加词条</DialogTitle>
                        <DialogDescription>添加新的词条</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>词条</Label>
                            <Input
                                value={addForm.word}
                                onChange={(e) => setAddForm(f => ({ ...f, word: e.target.value }))}
                                placeholder="输入词条..."
                            />
                        </div>

                        {activeTab === 'frequency' ? (
                            <div className="grid gap-2">
                                <Label>词频排名</Label>
                                <Input
                                    type="number"
                                    value={addForm.rank}
                                    onChange={(e) => setAddForm(f => ({ ...f, rank: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-2">
                                    <Label>等级</Label>
                                    <Select value={addForm.level} onValueChange={(v) => setAddForm(f => ({ ...f, level: v }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currentLevelOptions.map(l => (
                                                <SelectItem key={l} value={l}>{l}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {activeTab === 'llm-vocab' && (
                                    <>
                                        <div className="grid gap-2">
                                            <Label>读音</Label>
                                            <Input
                                                value={addForm.reading}
                                                onChange={(e) => setAddForm(f => ({ ...f, reading: e.target.value }))}
                                                placeholder="假名读音..."
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>定义</Label>
                                            <Input
                                                value={addForm.definition}
                                                onChange={(e) => setAddForm(f => ({ ...f, definition: e.target.value }))}
                                                placeholder="词义说明..."
                                            />
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
                        <Button onClick={addEntry} disabled={!addForm.word}>添加</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Article Detail Dialog */}
            <Dialog open={articleDetailOpen} onOpenChange={setArticleDetailOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>词汇分析详情</DialogTitle>
                        <DialogDescription>
                            {selectedArticle?.title}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-auto flex-1">
                        {articleDetailLoading ? (
                            <div className="text-center py-8">加载分析中...</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>词汇</TableHead>
                                        <TableHead>原形</TableHead>
                                        <TableHead>词性</TableHead>
                                        <TableHead>JLPT等级</TableHead>
                                        <TableHead>频率排名</TableHead>
                                        <TableHead>频率等级</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {articleWords.map((word, idx) => (
                                        <TableRow key={`${word.word}-${idx}`}>
                                            <TableCell className="font-medium">{word.word}</TableCell>
                                            <TableCell className="text-muted-foreground">{word.lemma}</TableCell>
                                            <TableCell className="text-muted-foreground">{word.pos}</TableCell>
                                            <TableCell>
                                                <Badge className={getLevelColor(word.level)}>{word.level}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {word.frequencyRank > 0 ? word.frequencyRank.toLocaleString() : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={getFrequencyColor(word.frequencyRank)}>
                                                    {word.frequencyLabel}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {articleWords.length === 0 && !articleDetailLoading && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                                暂无词汇数据
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t">
                        <span className="text-sm text-muted-foreground">
                            共 {articleWords.length} 个内容词
                        </span>
                        <Button variant="outline" onClick={() => setArticleDetailOpen(false)}>
                            关闭
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
