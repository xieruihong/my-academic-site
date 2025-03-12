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

    // 🔹 添加页脚信息
    footer: {
      message: 'This site is powered by VitePress.',
      copyright: '© 2025 Ruihong Xie. All rights reserved.'
    }
  }
}