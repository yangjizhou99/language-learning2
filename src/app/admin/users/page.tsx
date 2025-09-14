"use client";

import { useState, useEffect } from "react";
import { Container } from "@/components/Container";
import { supabase } from "@/lib/supabase";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Search, User, Calendar, Activity, TrendingUp, Filter, Eye, Settings } from "lucide-react";

interface User {
  id: string;
  email: string;
  username?: string;
  role: 'admin' | 'user';
  created_at: string;
  last_sign_in_at?: string;
  practice_stats: {
    total_shadowing_attempts: number;
    total_cloze_attempts: number;
    total_alignment_attempts: number;
    total_vocab_entries: number;
    last_activity?: string;
    average_scores: {
      shadowing: number;
      cloze: number;
      alignment: number;
    };
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async (page = 1, searchTerm = "", role = "all") => {
    setLoading(true);
    setError(null);
    try {
      console.log('正在获取用户列表...');
      
      // 获取用户认证信息
      const { data: { session } } = await supabase.auth.getSession();
      console.log('当前会话:', session ? '已登录' : '未登录');
      
      if (!session) {
        throw new Error('请先登录才能访问管理员页面');
      }

      console.log('用户信息:', {
        id: session.user.id,
        email: session.user.email
      });

      // 使用 API 路由获取用户数据，这样可以绕过 RLS 限制
      const limit = 20;
      const offset = (page - 1) * limit;

      // 构建查询参数
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: searchTerm,
        role: role
      });

      // 使用 API 路由获取用户数据，包含认证头
      console.log('发送 API 请求:', {
        url: `/api/admin/users?${params}`,
        headers: {
          'Authorization': `Bearer ${session.access_token?.substring(0, 20)}...`,
          'Content-Type': 'application/json'
        }
      });
      
      
      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取用户列表失败');
      }

      const data = await response.json();
      console.log('API 响应数据:', data);

      const users = data.users || [];
      const count = data.pagination.total;

      console.log('用户查询结果:', { users, count });

      // 获取每个用户的练习统计
      const userIds = users?.map(u => u.id) || [];
      console.log('用户ID列表:', userIds);
      const practiceStats = await getPracticeStats(userIds);

      const usersWithStats = users?.map(user => ({
        ...user,
        practice_stats: practiceStats[user.id] || {
          total_shadowing_attempts: 0,
          total_cloze_attempts: 0,
          total_alignment_attempts: 0,
          total_vocab_entries: 0,
          last_activity: null,
          average_scores: { shadowing: 0, cloze: 0, alignment: 0 }
        }
      })) || [];

      console.log('处理后的用户数据:', usersWithStats);
      setUsers(usersWithStats);
      setPagination({
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      setError(error instanceof Error ? error.message : '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getPracticeStats = async (userIds: string[]) => {
    if (userIds.length === 0) return {};

    const stats: Record<string, any> = {};

    // 初始化统计
    userIds.forEach(id => {
      stats[id] = {
        total_shadowing_attempts: 0,
        total_cloze_attempts: 0,
        total_alignment_attempts: 0,
        total_vocab_entries: 0,
        last_activity: null,
        average_scores: { shadowing: 0, cloze: 0, alignment: 0 }
      };
    });

    try {
      // Shadowing 统计
      try {
        const { data: shadowingStats } = await supabase
          .from('shadowing_attempts')
          .select('user_id, created_at, metrics')
          .in('user_id', userIds);

        shadowingStats?.forEach(attempt => {
          const userId = attempt.user_id;
          if (stats[userId]) {
            stats[userId].total_shadowing_attempts++;
            if (!stats[userId].last_activity || attempt.created_at > stats[userId].last_activity) {
              stats[userId].last_activity = attempt.created_at;
            }
            // 计算平均分数（如果有的话）
            if (attempt.metrics?.score) {
              const currentAvg = stats[userId].average_scores.shadowing;
              const count = stats[userId].total_shadowing_attempts;
              stats[userId].average_scores.shadowing = 
                (currentAvg * (count - 1) + attempt.metrics.score) / count;
            }
          }
        });
      } catch (error) {
        console.warn('获取 Shadowing 统计失败:', error);
      }

      // Cloze 统计
      try {
        const { data: clozeStats } = await supabase
          .from('cloze_attempts')
          .select('user_id, created_at, ai_result')
          .in('user_id', userIds);

        clozeStats?.forEach(attempt => {
          const userId = attempt.user_id;
          if (stats[userId]) {
            stats[userId].total_cloze_attempts++;
            if (!stats[userId].last_activity || attempt.created_at > stats[userId].last_activity) {
              stats[userId].last_activity = attempt.created_at;
            }
            // 计算平均分数
            if (attempt.ai_result?.overall?.score) {
              const currentAvg = stats[userId].average_scores.cloze;
              const count = stats[userId].total_cloze_attempts;
              stats[userId].average_scores.cloze = 
                (currentAvg * (count - 1) + attempt.ai_result.overall.score) / count;
            }
          }
        });
      } catch (error) {
        console.warn('获取 Cloze 统计失败:', error);
      }

      // Alignment 统计
      try {
        const { data: alignmentStats } = await supabase
          .from('alignment_attempts')
          .select('user_id, created_at, scores')
          .in('user_id', userIds);

        alignmentStats?.forEach(attempt => {
          const userId = attempt.user_id;
          if (stats[userId]) {
            stats[userId].total_alignment_attempts++;
            if (!stats[userId].last_activity || attempt.created_at > stats[userId].last_activity) {
              stats[userId].last_activity = attempt.created_at;
            }
            // 计算平均分数 - scores 是 JSONB 字段，包含 {fluency, relevance, style, overall}
            if (attempt.scores && typeof attempt.scores === 'object' && 'overall' in attempt.scores) {
              const currentAvg = stats[userId].average_scores.alignment;
              const count = stats[userId].total_alignment_attempts;
              stats[userId].average_scores.alignment = 
                (currentAvg * (count - 1) + (attempt.scores as any).overall) / count;
            }
          }
        });
      } catch (error) {
        console.warn('获取 Alignment 统计失败:', error);
      }

      // 词汇统计
      try {
        const { data: vocabStats } = await supabase
          .from('vocab_entries')
          .select('user_id, created_at')
          .in('user_id', userIds);

        vocabStats?.forEach(entry => {
          const userId = entry.user_id;
          if (stats[userId]) {
            stats[userId].total_vocab_entries++;
            if (!stats[userId].last_activity || entry.created_at > stats[userId].last_activity) {
              stats[userId].last_activity = entry.created_at;
            }
          }
        });
      } catch (error) {
        console.warn('获取词汇统计失败:', error);
      }

    } catch (error) {
      console.error('获取练习统计失败:', error);
    }

    return stats;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearch = () => {
    fetchUsers(1, search, roleFilter);
  };

  const handlePageChange = (newPage: number) => {
    fetchUsers(newPage, search, roleFilter);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '未知';
    try {
      return new Date(dateString).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return '无效日期';
    }
  };

  const getInitials = (primary: string, username?: string) => {
    if (username && username.length >= 2) {
      return username.substring(0, 2).toUpperCase();
    }
    if (primary && primary.length >= 2) {
      return primary.substring(0, 2).toUpperCase();
    }
    return "??";
  };

  const getTotalPracticeCount = (stats: User['practice_stats']) => {
    return stats.total_shadowing_attempts + stats.total_cloze_attempts + stats.total_alignment_attempts;
  };

  const getAverageScore = (stats: User['practice_stats']) => {
    const scores = [stats.average_scores.shadowing, stats.average_scores.cloze, stats.average_scores.alignment];
    const validScores = scores.filter(score => score > 0);
    if (validScores.length === 0) return 0;
    return validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
  };

  if (error) {
    return (
      <Container>
        <Breadcrumbs items={[
          { label: "管理员", href: "/admin" },
          { label: "用户管理", href: "/admin/users" }
        ]} />

        <div className="space-y-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-semibold text-red-600 mb-4">访问错误</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            {error.includes('登录') && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  请先登录管理员账户才能访问用户管理功能
                </p>
                <Button asChild>
                  <a href="/auth">前往登录</a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Breadcrumbs items={[
        { label: "管理员", href: "/admin" },
        { label: "用户管理", href: "/admin/users" }
      ]} />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">用户管理</h1>
            <p className="text-muted-foreground">管理用户账户、权限和练习数据</p>
          </div>
        </div>

        <Breadcrumbs items={[
          { label: "管理员", href: "/admin" },
          { label: "用户管理", href: "/admin/users" }
        ]} />

        {/* 搜索和筛选 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              搜索和筛选
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="搜索用户名..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有角色</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="user">普通用户</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle>用户列表 ({pagination.total} 个用户)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>注册时间</TableHead>
                      <TableHead>最后活动</TableHead>
                      <TableHead>练习统计</TableHead>
                      <TableHead>平均分数</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {getInitials(user.username || user.id, user.username)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {user.username || `用户 ${user.id.slice(0, 8)}`}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ID: {user.id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? '管理员' : '用户'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(user.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.practice_stats.last_activity ? (
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-green-500" />
                              {formatDate(user.practice_stats.last_activity)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">无活动</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-blue-500" />
                              <span className="text-sm">
                                总计: {getTotalPracticeCount(user.practice_stats)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Shadowing: {user.practice_stats.total_shadowing_attempts} | 
                              Cloze: {user.practice_stats.total_cloze_attempts} | 
                              Alignment: {user.practice_stats.total_alignment_attempts}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {getAverageScore(user.practice_stats).toFixed(1)}
                            </span>
                            <span className="text-xs text-muted-foreground">/ 10</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/users/${user.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                查看
                              </Button>
                            </Link>
                            <Link href={`/admin/users/${user.id}/permissions`}>
                              <Button variant="outline" size="sm">
                                <Settings className="h-4 w-4 mr-1" />
                                权限
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* 分页 */}
                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      显示第 {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                      >
                        上一页
                      </Button>
                      <span className="text-sm">
                        第 {pagination.page} 页，共 {pagination.pages} 页
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.pages}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
