import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SceneVector {
    scene_id: string;
    name_cn: string;
    weight: number;
}

interface SceneVectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    themeId: string | null;
    themeTitle: string;
}

export function SceneVectorModal({ isOpen, onClose, themeId, themeTitle }: SceneVectorModalProps) {
    const [vectors, setVectors] = useState<SceneVector[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && themeId) {
            setLoading(true);

            // 获取 session token
            import('@/lib/supabase').then(({ supabase }) => {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    const headers: HeadersInit = {};
                    if (session?.access_token) {
                        headers['Authorization'] = `Bearer ${session.access_token}`;
                    }

                    fetch(`/api/admin/shadowing/themes/vectors?theme_id=${themeId}`, { headers })
                        .then(res => {
                            if (res.status === 401) {
                                throw new Error('Unauthorized');
                            }
                            return res.json();
                        })
                        .then(data => {
                            if (data.success) {
                                setVectors(data.vectors);
                            }
                        })
                        .catch(err => {
                            console.error('Failed to fetch vectors:', err);
                            setVectors([]);
                        })
                        .finally(() => setLoading(false));
                });
            });
        } else {
            setVectors([]);
        }
    }, [isOpen, themeId]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>场景向量: {themeTitle}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">加载中...</div>
                    ) : vectors.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">暂无场景数据</div>
                    ) : (
                        <div className="space-y-4">
                            {vectors.map(v => (
                                <div key={v.scene_id} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span>{v.name_cn} ({v.scene_id})</span>
                                        <span className="font-mono">{v.weight.toFixed(2)}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${v.weight * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
