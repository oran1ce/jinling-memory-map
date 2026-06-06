// @title 登录

import { useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/client/supabase'

// 用户名：最多14个字符（含中英文、数字、下划线）
const USERNAME_MAX = 14
// 密码：5-10位，仅大小写字母和数字
const PASSWORD_REGEX = /^[a-zA-Z0-9]{5,10}$/

export default function LoginPage() {
  const { signInWithUsername, signUpWithUsername } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  // 校验状态
  const usernameError = useMemo(() => {
    if (!username) return ''
    if (username.length > USERNAME_MAX) return '用户名过长，最多14个字符'
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(username)) return '用户名仅支持中英文、数字和下划线'
    return ''
  }, [username])

  const passwordError = useMemo(() => {
    if (!password) return ''
    if (password.length < 5) return '密码过短，至少5位'
    if (password.length > 10) return '密码过长，最多10位'
    if (!PASSWORD_REGEX.test(password)) return '密码仅限大小写字母和数字'
    return ''
  }, [password])

  const canSubmit = useMemo(() => {
    if (!username || !password || !agreed) return false
    if (usernameError || passwordError) return false
    return true
  }, [username, password, agreed, usernameError, passwordError])

  const handleUsernameLogin = async () => {
    if (!username || !password) {
      Taro.showToast({ title: '请输入用户名和密码', icon: 'none' })
      return
    }
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }
    setLoading(true)
    const { error } = await signInWithUsername(username, password)
    setLoading(false)
    if (error) {
      Taro.showToast({ title: error.message || '登录失败', icon: 'none' })
    } else {
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/map/index' })
      }, 800)
    }
  }

  const handleRegister = async () => {
    if (!username || !password) {
      Taro.showToast({ title: '请输入用户名和密码', icon: 'none' })
      return
    }
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }
    if (usernameError || passwordError) return

    setLoading(true)

    // 检查用户名是否已被注册（通过查询 profiles 表）
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingUser) {
      setLoading(false)
      Taro.showToast({ title: '该用户名重复，请更换用户名', icon: 'none' })
      return
    }

    const { error } = await signUpWithUsername(username, password)
    setLoading(false)

    if (error) {
      // 如果 Supabase 返回 email 已存在，说明该用户名已被注册
      const msg = error.message || ''
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('unique')) {
        Taro.showToast({ title: '该用户名重复，请更换用户名', icon: 'none' })
      } else {
        Taro.showToast({ title: msg || '注册失败', icon: 'none' })
      }
    } else {
      Taro.showToast({ title: '注册成功', icon: 'success' })
      setMode('login')
    }
  }

  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-sm">
        {/* 标题 */}
        <div className="text-center mb-10">
          <div className="text-3xl font-bold text-violet-deep mb-3">金陵拾光记</div>
          <div className="text-xl text-muted-foreground">用足迹书写校园故事</div>
        </div>

        {/* 协议勾选 */}
        <div className="flex items-center gap-2 mb-8" onClick={() => setAgreed(!agreed)}>
          <div className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center ${agreed ? 'bg-violet-deep border-violet-deep' : 'border-input bg-background'}`}>
            {agreed && <div className="i-mdi-check text-white text-sm" />}
          </div>
          <div className="flex flex-wrap text-lg text-muted-foreground">
            <span>我已阅读并同意</span>
            <span className="text-violet-deep">《用户协议》</span>
            <span>和</span>
            <span className="text-violet-deep">《隐私政策》</span>
          </div>
        </div>

        {/* 用户名密码表单 */}
        <div className="flex flex-col gap-4 mb-6">
          {/* 用户名 */}
          <div>
            <div className="border-2 border-input rounded-sm px-4 py-3 bg-background overflow-hidden">
              <input
                className="w-full text-xl text-foreground bg-transparent outline-none"
                placeholder="用户名"
                maxLength={USERNAME_MAX + 1}
                value={username}
                onInput={(e) => { const ev = e as any; setUsername(ev.detail?.value ?? ev.target?.value ?? '') }}
              />
            </div>
            {usernameError && (
              <div className="mt-1 text-base text-destructive">{usernameError}</div>
            )}
            {mode === 'register' && username && !usernameError && (
              <div className="mt-1 text-base text-muted-foreground">用户名可用</div>
            )}
          </div>

          {/* 密码 */}
          <div>
            <div className="border-2 border-input rounded-sm px-4 py-3 bg-background overflow-hidden">
              <input
                className="w-full text-xl text-foreground bg-transparent outline-none"
                type="password"
                placeholder="密码"
                maxLength={11}
                value={password}
                onInput={(e) => { const ev = e as any; setPassword(ev.detail?.value ?? ev.target?.value ?? '') }}
              />
            </div>
            {passwordError && (
              <div className="mt-1 text-base text-destructive">{passwordError}</div>
            )}
          </div>

          <button
            type="button"
            onClick={mode === 'login' ? handleUsernameLogin : handleRegister}
            disabled={loading || !canSubmit}
            className="w-full py-4 bg-violet-deep text-white rounded-sm text-xl font-medium flex items-center justify-center paper-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{mode === 'login' ? '登录' : '注册'}</span>
          </button>
        </div>

        {/* 切换模式 */}
        <div className="flex flex-col gap-3 items-center">
          {mode === 'login' && (
            <button type="button" onClick={() => setMode('register')} className="text-lg text-muted-foreground">
              没有账号？立即注册
            </button>
          )}
          {mode === 'register' && (
            <button type="button" onClick={() => setMode('login')} className="text-lg text-muted-foreground">
              已有账号？去登录
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
