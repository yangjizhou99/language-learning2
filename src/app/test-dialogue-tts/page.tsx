"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function TestDialogueTTS() {
  const [text, setText] = useState(`A: Hello, how are you today?
B: I'm doing great, thank you! How about you?
A: I'm also doing well. What are your plans for the weekend?
B: I'm planning to visit the museum. Would you like to join me?`);
  
  const [lang, setLang] = useState<"en"|"ja"|"zh">("en");
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // 检测是否为对话格式
  function isDialogueFormat(text: string): boolean {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    return lines.some(line => /^[A-Z]:\s/.test(line));
  }

  // 解析对话文本
  function parseDialogue(text: string): { speaker: string; content: string }[] {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const dialogue: { speaker: string; content: string }[] = [];
    
    for (const line of lines) {
      const match = line.match(/^([A-Z]):\s*(.+)$/);
      if (match) {
        dialogue.push({
          speaker: match[1],
          content: match[2].trim()
        });
      }
    }
    
    return dialogue;
  }

  async function testDialogueTTS() {
    if (!text.trim()) {
      toast.error("请输入对话文本");
      return;
    }

    setLoading(true);
    setAudioUrl(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/shadowing/synthesize-dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          lang: lang,
          speakingRate: speakingRate,
          pitch: pitch
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '合成失败');
      }

      setResult(data);
      setAudioUrl(data.audio_url);
      toast.success(`对话音频合成成功！包含 ${data.dialogue_count} 段对话，角色: ${data.speakers.join(', ')}`);
    } catch (error) {
      console.error('TTS 测试失败:', error);
      toast.error(`合成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }

  const dialogue = parseDialogue(text);
  const isDialogue = isDialogueFormat(text);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">对话 TTS 测试</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>测试对话音频合成</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">语言</label>
              <Select value={lang} onValueChange={(value) => setLang(value as "en"|"ja"|"zh")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="zh">简体中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">语速 ({speakingRate.toFixed(1)})</label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speakingRate}
                onChange={(e) => setSpeakingRate(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium">音调 ({pitch > 0 ? '+' : ''}{pitch})</label>
              <input
                type="range"
                min="-10"
                max="10"
                step="1"
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={testDialogueTTS} 
                disabled={loading}
                className="w-full"
              >
                {loading ? "合成中..." : "测试对话 TTS"}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">对话文本</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入对话文本，格式: A: 内容\nB: 内容"
              className="min-h-32"
            />
          </div>

          {/* 格式检测结果 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">格式检测:</span>
              <Badge variant={isDialogue ? "default" : "outline"}>
                {isDialogue ? "对话格式" : "普通格式"}
              </Badge>
            </div>
            
            {isDialogue && (
              <div className="space-y-1">
                <div className="text-sm font-medium">解析结果:</div>
                <div className="text-sm text-gray-600">
                  检测到 {dialogue.length} 段对话，角色: {[...new Set(dialogue.map(d => d.speaker))].join(', ')}
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {dialogue.map((item, index) => (
                    <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                      <span className="font-medium text-blue-600">{item.speaker}:</span> {item.content}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 音色说明 */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-blue-800 mb-2">🎵 音色配置说明</div>
            <div className="text-xs text-blue-700 space-y-1">
              <div>• <strong>英语:</strong> A角色(女性) - en-US-Neural2-F, B角色(男性) - en-US-Neural2-D</div>
              <div>• <strong>日语:</strong> A角色(女性) - ja-JP-Neural2-A, B角色(男性) - ja-JP-Neural2-D</div>
              <div>• <strong>中文:</strong> A角色(女性) - cmn-CN-Neural2-A, B角色(男性) - cmn-CN-Neural2-B</div>
              <div>• 系统会自动为不同角色调整语速和音调，使对话更自然</div>
            </div>
          </div>

          {/* 合成结果 */}
          {result && (
            <div className="space-y-2">
              <div className="text-sm font-medium">合成结果:</div>
              <div className="text-sm text-gray-600">
                音频大小: {Math.round(result.bytes / 1024)} KB | 
                对话段数: {result.dialogue_count} | 
                角色: {result.speakers.join(', ')}
              </div>
            </div>
          )}

          {/* 音频播放器 */}
          {audioUrl && (
            <div className="space-y-2">
              <div className="text-sm font-medium">生成的音频:</div>
              <audio controls src={audioUrl} preload="metadata" className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 示例对话 */}
      <Card>
        <CardHeader>
          <CardTitle>示例对话</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium mb-2">英语对话</h4>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setText(`A: Hello, how are you today?
B: I'm doing great, thank you! How about you?
A: I'm also doing well. What are your plans for the weekend?
B: I'm planning to visit the museum. Would you like to join me?`)}
              >
                加载示例
              </Button>
            </div>
            <div>
              <h4 className="font-medium mb-2">日语对话</h4>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setText(`A: こんにちは、お元気ですか？
B: はい、元気です。ありがとうございます。あなたはどうですか？
A: 私も元気です。週末の予定はありますか？
B: 美術館に行く予定です。一緒に行きませんか？`)}
              >
                加载示例
              </Button>
            </div>
            <div>
              <h4 className="font-medium mb-2">中文对话</h4>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setText(`A: 你好，今天怎么样？
B: 我很好，谢谢！你呢？
A: 我也很好。你周末有什么计划吗？
B: 我计划去博物馆。你想和我一起去吗？`)}
              >
                加载示例
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
