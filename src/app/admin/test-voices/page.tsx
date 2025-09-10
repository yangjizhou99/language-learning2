"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";

export default function TestVoicesPage() {
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voices, setVoices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const syncVoices = async () => {
    try {
      setSyncing(true);
      setError(null);
      setMessage(null);
      
      console.log("开始同步音色数据...");
      const response = await fetch("/api/admin/shadowing/sync-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log("音色同步成功:", data.message);
        console.log("同步统计:", data.stats);
        setMessage(`同步成功！共同步 ${data.totalVoices} 个音色`);
        
        // 同步成功后获取音色列表
        await fetchVoices();
      } else {
        console.error("音色同步失败:", data.error);
        setError(`同步失败: ${data.error}`);
      }
    } catch (err) {
      console.error("音色同步失败:", err);
      setError("同步失败，请重试");
    } finally {
      setSyncing(false);
    }
  };

  const fetchVoices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/admin/shadowing/voices-db?lang=all");
      const data = await response.json();
      
      if (data.success) {
        setVoices(data.voices || []);
        console.log("获取音色成功:", data.voices?.length, "个音色");
        console.log("语言分布:", data.groupedByLanguage);
      } else {
        setError(`获取音色失败: ${data.error}`);
      }
    } catch (err) {
      console.error("获取音色失败:", err);
      setError("获取音色失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">音色管理测试</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>音色同步</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={syncVoices} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              同步音色
            </Button>
            <Button onClick={fetchVoices} disabled={loading} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              获取音色
            </Button>
          </div>
          
          {message && (
            <div className="p-3 bg-green-100 text-green-800 rounded">
              {message}
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-100 text-red-800 rounded">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>音色列表 ({voices.length} 个)</CardTitle>
        </CardHeader>
        <CardContent>
          {voices.length > 0 ? (
            <div className="space-y-2">
              {voices.slice(0, 10).map((voice, index) => (
                <div key={voice.id || index} className="p-2 border rounded">
                  <div className="font-medium">{voice.display_name || voice.name}</div>
                  <div className="text-sm text-gray-600">
                    {voice.language_code} • {voice.ssml_gender} • {voice.category}
                  </div>
                </div>
              ))}
              {voices.length > 10 && (
                <div className="text-sm text-gray-500">
                  还有 {voices.length - 10} 个音色...
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">暂无音色数据</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
