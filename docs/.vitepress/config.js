// docs/.vitepress/config.js
export default {
  title: 'Ruihong Xie | Academic Homepage',
  description: 'Personal academic website of Ruihong Xie',
  
  base: '/my-academic-site/', // 仓库名，确保和 GitHub Pages 部署路径一致
  outDir: '../dist', // 输出目录

  themeConfig: {
    // 🔹 美化导航栏
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Research', link: '/investigation' },
      { text: 'Publications', link: '/publications' },
      { text: 'Awards', link: '/Awards and honours' },
      { text: 'Contact', link: '/contact' }
    ],

    // 🔹 改进侧边栏结构
    sidebar: {
      '/': [
        {
          text: '📂 Catalogue',
          collapsible: true,
          collapsed: false,
          items: [
            { text: '🏠 Home', link: '/' },
            { text: '🎓 Educational Experience', link: '/Educational experience' },
            { text: '🏆 Awards and Honours', link: '/Awards and honours' },
            { text: '🔬 Research', link: '/investigation' },
            { text: '📄 Publications', link: '/publications' },
            { text: '📬 Contact', link: '/contact' }
          ]
        }
      ]
    },

    // 🔹 添加社交链接
    socialLinks: [
      { icon: 'Researchgate', link: 'https://www.researchgate.net/profile/Ruihong-Xie' },
      { icon: 'Scholar', link: 'https://scholar.google.com/citations?user=34ISQHEAAAAJ&hl=zh-CN&oi=ao' }
    ],

    // 更新后的页脚配置
    footer: {
      message: '📬 Follow my research journey | <a href="/feed.xml">RSS Feed</a>',
      copyright: '© 2025 Ruihong Xie | Licensed under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>'
    },

    // 增强的社交链接配置
    socialLinks: [
      { 
        icon: 'researchgate',
        link: 'https://www.researchgate.net/profile/Ruihong-Xie',
        ariaLabel: 'ResearchGate Profile'
      },
      {
        icon: 'google-scholar',
        link: 'https://scholar.google.com/citations?user=34ISQHEAAAAJ',
        ariaLabel: 'Google Scholar Profile'
      }
    ]
  },

  // 新增 head 配置
  head: [
    ['link', { 
      rel: 'stylesheet', 
      href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' 
    }]
  ]
}
