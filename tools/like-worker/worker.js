/**
 * 博客点赞/点踩 Worker —— 零隐私设计：
 * - 只存每个页面的两个数字（赞/踩），不存 IP、不存任何身份标识
 * - 防重复投票由前端 localStorage 负责（只在访客自己电脑上）
 * - 免费额度 10 万请求/天，个人博客用不完
 *
 * 部署：见同目录 DEPLOY.md
 */

const ALLOWED_ORIGIN = 'https://ausvaldoo.github.io' // 只允许自己的博客调用

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  })
}

// 页面路径 -> KV key（只留安全字符，防止 key 注入/超长）
function keyFor(page) {
  return 'p:' + String(page).replace(/[^a-zA-Z0-9_\-/]/g, '_').slice(0, 180)
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const url = new URL(request.url)
    const page = url.searchParams.get('page')
    if (!page) return json({ error: 'missing page' }, 400)

    const key = keyFor(page)

    if (request.method === 'GET') {
      const raw = await env.LIKES.get(key)
      const data = raw ? JSON.parse(raw) : { likes: 0, dislikes: 0 }
      return json(data)
    }

    if (request.method === 'POST') {
      const vote = url.searchParams.get('vote')
      if (vote !== 'like' && vote !== 'dislike') {
        return json({ error: 'bad vote' }, 400)
      }
      const raw = await env.LIKES.get(key)
      const data = raw ? JSON.parse(raw) : { likes: 0, dislikes: 0 }
      data[vote === 'like' ? 'likes' : 'dislikes'] += 1
      await env.LIKES.put(key, JSON.stringify(data))
      return json(data)
    }

    return json({ error: 'method not allowed' }, 405)
  },
}
