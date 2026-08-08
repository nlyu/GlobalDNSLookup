# Global DNS Lookup 技术设计与开发规范

版本：1.0  
状态：可进入 V1 开发  
最后更新：2026-08-08

## 1. 产品定义

Global DNS Lookup 是一个面向开发者、SRE、网络工程师和 CDN 工程师的全球 DNS 对比工具。

用户输入一个域名后，网站使用代表性 EDNS Client Subnet（ECS）查询多个地区可能获得的：

- CNAME 链
- A 记录
- AAAA 记录
- 每条记录的 TTL
- 实际使用的递归 DNS 服务商
- ECS subnet
- 查询状态和错误信息

核心交互必须保持简单：

```text
输入域名 -> Lookup -> 按地区逐行显示结果
```

本产品提供的是基于代表性网络前缀的模拟结果，不是真实部署在每个国家的探针，也不能代表该国家所有 ISP 和用户。

页面统一使用以下描述：

> DNS results simulated using representative network prefixes and public recursive resolvers.

## 2. V1 范围

### 2.1 必须实现

- 支持输入域名或 URL，并自动提取 hostname
- 支持 A 和 AAAA 查询
- 从 A、AAAA 响应中提取完整 CNAME 链
- 支持 26 个代表性地区
- 每个地区独立显示 loading、success 和 error 状态
- 显示每种记录实际使用的 resolver
- 保存并显示 TTL
- Google Public DNS 为首选 resolver
- AliDNS 为可配置 fallback
- resolver 熔断和请求 fallback
- 浏览器缓存
- 并发限制和请求超时
- 响应式桌面表格和移动端卡片
- 静态 SEO 内容
- Privacy、About、Contact 页面
- robots.txt 和 sitemap.xml

### 2.2 不在 V1 实现

- 用户账号和登录
- 查询历史同步
- 数据库
- 付费 API
- 200 个国家
- ISP 选择
- DNSSEC 调试界面
- MX、TXT、NS、SOA、CAA 查询
- WHOIS、ping、traceroute
- RIPE Atlas 实时探针
- 分享结果链接
- 地图和复杂 dashboard

## 3. 准确性边界

每个国家在 V1 只配置一个代表性 IPv4 `/24` ECS subnet。

结果可能受到以下因素影响：

- 所选 subnet 和 ASN
- authoritative DNS 是否支持 ECS
- recursive resolver 的缓存
- CDN 调度策略
- ECS scope
- ISP 和网络拓扑
- DNS provider 对 ECS 的截断或处理策略

因此 UI 必须显示：

- `Representative subnet`
- `Resolver`
- 查询时间
- 简短免责声明

禁止使用以下表述：

> 这是中国所有用户获得的 DNS 结果。

推荐表述：

> This result represents DNS resolution for the selected network prefix. Actual results may vary by ISP, resolver and location.

## 4. 总体架构

默认架构保持静态：

```text
Static Hosting
      |
      v
HTML / CSS / JavaScript
      |
      v
User Browser
      |
      +----> Google Public DNS JSON API
      |
      +----> AliDNS JSON API
```

如果 AliDNS 匿名接口、CORS 或服务政策发生变化，则启用最小 serverless resolver proxy：

```text
User Browser
      |
      +----> Google Public DNS
      |
      +----> /api/dns-fallback
                    |
                    +----> DNSPod Public DNS
                    |
                    +----> 360 Secure DNS
```

serverless function 只能代理预先配置的 DNS provider，不允许用户传入任意目标 URL。

## 5. 技术栈

V1 使用：

- HTML5
- CSS
- Vanilla JavaScript
- 浏览器原生 ES modules
- Node.js 内置测试
- 无第三方运行时或构建依赖
- 小型 DNS packet library，仅在标准 wire-format DoH fallback 需要时加入

不使用：

- React
- Vue
- Angular
- Next.js
- UI component framework
- 数据库
- 长期运行的 VM

生产构建通过一个小型 Node.js 脚本复制静态资源，不进行框架打包。输出必须是静态文件：

```text
dist/
  index.html
  assets/
  privacy/
  about/
  contact/
  robots.txt
  sitemap.xml
```

## 6. Resolver 策略

### 6.1 Google Public DNS

首选接口：

```text
https://dns.google/resolve
```

参数：

```text
name=<hostname>
type=A|AAAA
edns_client_subnet=<representative subnet>
```

Google 官方 JSON API 明确支持 `edns_client_subnet`。

Google 响应是合法 DNS 响应时，不应因为结果为空而 fallback。

以下状态是合法结果：

- NOERROR，有记录
- NOERROR，无 A
- NOERROR，无 AAAA
- NOERROR，无 CNAME
- NXDOMAIN

以下情况可以 fallback：

- 网络错误
- AbortController timeout
- HTTP 429
- HTTP 5xx
- JSON 格式错误
- 响应缺少必要字段
- provider 返回无法使用的 SERVFAIL 或 REFUSED

### 6.2 AliDNS

截至 2026-08-08，以下接口经过实际请求验证：

```text
https://dns.alidns.com/resolve
```

验证结果：

- 不带 Account ID、AccessKey 和签名时可以返回 DNS JSON
- 返回 `Access-Control-Allow-Origin: *`
- 接受 `edns_client_subnet`
- 响应包含 ECS 信息
- 支持 A 和 AAAA

示例：

```text
https://dns.alidns.com/resolve
  ?name=www.example.com
  &type=A
  &edns_client_subnet=1.0.1.0/24
```

重要限制：

- 当前公开文档主要描述需要鉴权的 HTTPDNS 产品接口
- 匿名 JSON 行为可能没有明确的长期 SLA
- 上线前必须再次执行浏览器 CORS、ECS、限速和服务条款检查
- 必须通过配置开关控制 AliDNS，不应把它写死成唯一 fallback

配置示例：

```javascript
const resolverConfig = {
  google: {
    enabled: true,
    endpoint: "https://dns.google/resolve"
  },
  alidns: {
    enabled: true,
    endpoint: "https://dns.alidns.com/resolve"
  }
};
```

### 6.3 中国地区的其他 DNS 选择

如果 AliDNS 无法继续匿名使用，推荐顺序如下。

#### DNSPod Public DNS

标准 DoH：

```text
https://doh.pub/dns-query
```

实测结果：

- 标准 wire-format DoH 可以匿名请求
- DNS wire packet 中的 ECS option 会被接受并在响应中返回
- 当前响应没有 `Access-Control-Allow-Origin`
- 浏览器前端不能直接读取响应

因此 DNSPod 适合作为 serverless proxy 后面的第一备用 resolver。

#### 360 Secure DNS

标准 DoH：

```text
https://doh.360.cn/dns-query
```

实测结果：

- 可以匿名请求
- 可以接收包含 ECS 的 wire-format query
- 当前没有浏览器 CORS 响应头
- ECS scope 行为需要进一步测试

因此 360 适合作为第二备用 resolver，不建议在 V1 中直接从浏览器调用。

#### 自建递归查询服务

如果第三方公共 DNS 的政策、CORS 或稳定性无法满足要求，可以部署一个极小的 resolver API：

- 固定查询 A 和 AAAA
- 固定允许的上游 resolver
- 支持 ECS
- 不保存查询历史
- 加入速率限制
- 不开放通用 DNS proxy

这会增加成本和运维工作，只作为最后选择。

### 6.4 推荐最终顺序

默认：

```text
Google -> AliDNS
```

AliDNS 不可用时：

```text
Google -> serverless proxy -> DNSPod -> 360
```

不要在浏览器中尝试绕过 CORS，也不要使用公共 CORS proxy。

## 7. Resolver 熔断

如果 Google 在中国大陆无法访问，不能让 26 个请求分别等待 3 秒后才 fallback。

应用应维护短期 provider health：

```javascript
{
  google: {
    state: "healthy" | "unavailable" | "unknown",
    retryAfter: 0
  },
  alidns: {
    state: "healthy" | "unavailable" | "unknown",
    retryAfter: 0
  }
}
```

规则：

1. 初始 provider 状态为 `unknown`。
2. 第一次 provider 网络失败后，标记为 `unavailable`。
3. 后续任务在 60 秒内直接使用下一个 provider。
4. 60 秒后允许一个请求试探恢复。
5. NXDOMAIN、NODATA 等合法 DNS 结果不能触发熔断。
6. HTTP 429 应按照退避时间暂停该 provider。

## 8. 请求模型

每个 location 发送两类查询：

```text
A
AAAA
```

不单独发送 CNAME 查询。CNAME 从 A 和 AAAA 响应中提取并合并。

每个地区最多产生：

- 正常情况：2 个请求
- 两个请求都 fallback：4 个请求

26 个地区正常约为 52 个请求。

## 9. 数据模型

resolver 必须按查询类型保存，不能只在 location 层保存一个字符串。

```javascript
{
  location: {
    code: "KR",
    name: "South Korea",
    flag: "🇰🇷",
    subnet: "x.x.x.0/24"
  },
  cname: [
    {
      name: "edge.example.net.",
      ttl: 60,
      source: "A",
      resolver: "Google"
    }
  ],
  a: {
    records: [
      {
        value: "1.2.3.4",
        ttl: 30
      }
    ],
    resolver: "Google",
    status: "success",
    error: null
  },
  aaaa: {
    records: [],
    resolver: "AliDNS",
    status: "no_data",
    error: null
  },
  status: "partial_success",
  startedAt: 0,
  completedAt: 0
}
```

location 总状态：

- `loading`
- `success`
- `partial_success`
- `nxdomain`
- `failed`

查询状态：

- `success`
- `no_data`
- `nxdomain`
- `timeout`
- `rate_limited`
- `provider_unavailable`
- `malformed_response`
- `failed`

## 10. TTL 处理

不能把整个 location 简化成一个 TTL。

内部必须保存每条记录自己的 TTL。

表格默认显示：

- A 最小 TTL
- AAAA 最小 TTL

详情视图显示全部记录和 TTL。

缓存过期时间取该查询结果中最小的正数 TTL，并设置安全边界：

```text
minimum cache time: 5 seconds
maximum cache time: 300 seconds
```

NXDOMAIN 和 NODATA 在 V1 可缓存 30 秒。

## 11. 缓存

V1 优先使用内存缓存。

可选使用 `sessionStorage`，不默认使用长期 `localStorage`。

缓存 key：

```text
resolver|normalized-domain|record-type|ecs-subnet
```

示例：

```text
google|www.example.com|A|1.0.1.0/24
```

缓存内容：

```javascript
{
  value: {},
  expiresAt: 0
}
```

不记录用户完整查询历史。

## 12. 并发和超时

并发限制按单个 HTTP 请求计算：

```text
MAX_CONCURRENCY = 8
```

超时：

```text
Google: 3000 ms
AliDNS: 3000 ms
serverless fallback: 4000 ms
```

所有请求必须使用 `AbortController`。

每个 location 完成后立即更新 UI，不等待所有任务结束。

## 13. 域名规范化

接受：

```text
example.com
www.example.com
https://example.com
https://www.example.com/path?q=1
example.com.
中文域名.example
```

处理步骤：

1. trim
2. 如果包含协议，使用 `URL` 提取 hostname
3. 如果没有协议，使用临时 `https://` 解析
4. 删除末尾的 dot，仅在内部查询时统一补回
5. 使用浏览器 URL API 转为 punycode
6. 转为小写
7. 验证总长度和 label 长度

拒绝：

- 空输入
- localhost
- IP literal
- 含空格或无效字符
- label 超过 63 bytes
- hostname 超过 253 bytes
- 非公开单标签 hostname

## 14. ECS 地区数据

文件：

```text
src/data/geo-prefixes.json
```

每个地区格式：

```json
{
  "code": "KR",
  "name": "South Korea",
  "flag": "🇰🇷",
  "subnet": "x.x.x.0/24",
  "asn": 0,
  "source": "RIPE Atlas",
  "verifiedAt": "2026-08-08"
}
```

V1 地区：

- United States
- Canada
- Brazil
- United Kingdom
- Germany
- France
- Netherlands
- China Mainland（AliDNS 优先，Google fallback）
- Hong Kong（Google 优先，AliDNS fallback）
- Taiwan
- Malaysia
- Indonesia
- Thailand
- Vietnam
- Philippines
- United Arab Emirates
- New Zealand
- Mexico
- Spain
- Italy
- South Africa
- Japan
- South Korea
- Singapore
- India
- Australia

选择规则：

- 必须是公开 IPv4 prefix
- 当前归属目标国家
- 优先住宅或常见 ISP 网络
- 避免云计算数据中心
- 避免保留地址和特殊用途网络
- 保存 ASN、来源和验证日期
- 每次发布前抽样验证

不能直接使用个人设备的完整 IP 地址。

## 15. UI

桌面端使用结果表格：

| Location | CNAME | A | AAAA | Resolver | Status |
| --- | --- | --- | --- | --- | --- |

当 A 和 AAAA 使用不同 resolver 时显示：

```text
A: Google
AAAA: AliDNS
```

移动端每个 location 使用紧凑卡片。

查询开始时立即生成所有地区：

```text
United States  Querying...
Canada         Querying...
China Mainland Querying...
Hong Kong      Querying...
```

错误不能统一显示为 `Error`，必须显示具体原因。

## 16. Accessibility

- input 必须有关联 label
- Lookup button 可通过键盘操作
- Enter 可提交
- 使用 `aria-live` 宣布查询状态
- table 使用正确的 header
- loading 和 error 不只依赖颜色
- 支持 reduced motion
- 移动端触控目标不小于 44px

## 17. SEO

首页 HTML 必须静态包含：

- title
- meta description
- canonical URL
- H1
- 产品说明
- DNS 知识内容
- FAQ

建议主题：

- What is Global DNS Lookup?
- Why DNS results differ by country
- What is an A record?
- What is an AAAA record?
- What is a CNAME?
- What is EDNS Client Subnet?
- Why results differ between resolvers

不要让核心工具被 SEO 内容挤到首屏以下。

## 18. 隐私

网站自身：

- 不要求账号
- 不保存查询历史
- 不把查询发送到自有数据库

但必须明确说明：

- 查询的域名会发送给 Google、AliDNS 或其他配置的 DNS provider
- ECS subnet 是产品预先配置的代表性网络前缀，不是用户的真实 IP
- DNS provider 可能按照自己的隐私政策记录请求
- 如果加入 Analytics 或 AdSense，会产生第三方 cookie 或遥测

Privacy Policy 必须列出当前实际启用的 resolver。

## 19. Serverless fallback 安全要求

如果启用 `/api/dns-fallback`：

- 只允许 GET 或 POST
- 只允许 A 和 AAAA
- hostname 必须严格验证
- ECS 必须来自服务器维护的 allowlist
- 上游 resolver 必须写死
- 禁止代理任意 URL
- 禁止查询本地、私有或保留 hostname
- 限制请求体大小
- 设置超时
- 加入每 IP 速率限制
- 不记录完整查询内容
- 返回明确的 HTTP 和 DNS 错误

这样可以避免 serverless function 变成开放代理或 DNS 滥用入口。

## 20. Hosting

静态站点可以使用：

- Cloudflare Pages
- GitHub Pages
- Azure Static Web Apps
- Netlify
- Vercel

但如果中国大陆访问是正式 SLA：

- 必须从中国大陆网络实测站点和所有 resolver
- 境外静态托管不保证中国大陆长期稳定
- 中国大陆 CDN 或托管通常涉及域名备案和供应商要求

因此 V1 将“中国大陆可访问”定义为 best effort，不承诺 SLA。

## 21. 测试

### 21.1 单元测试

- 域名和 URL normalize
- IDN 转 punycode
- DNS status mapping
- CNAME chain 合并和去重
- 每条记录 TTL 保留
- cache key
- cache expiration
- fallback 条件
- NXDOMAIN 不 fallback
- provider 熔断
- mixed resolver

### 21.2 集成测试

- Google A、AAAA、CNAME
- Google ECS
- AliDNS A、AAAA、CNAME
- AliDNS ECS
- AliDNS CORS
- Google timeout 后 fallback
- provider 429
- NXDOMAIN
- NODATA
- malformed JSON
- AbortController

### 21.3 浏览器测试

- Chrome
- Edge
- Firefox
- Safari
- Android Chrome
- iOS Safari

### 21.4 发布前 resolver smoke test

每次发布前测试：

```text
endpoint reachable
CORS allowed
ECS accepted
A works
AAAA works
NXDOMAIN mapping works
response schema unchanged
```

## 22. 可观测性

默认不收集用户查询内容。

可收集不包含域名的匿名运行指标：

- resolver success rate
- resolver timeout rate
- HTTP status
- country configuration code
- request duration bucket
- fallback count

如果无法保证指标不包含查询域名，则 V1 不接入遥测。

## 23. 推荐目录结构

```text
src/
  index.html
  css/
    style.css
  js/
    app.js
    config.js
    domain.js
    queue.js
    cache.js
    dns/
      resolver.js
      google.js
      alidns.js
      parser.js
      errors.js
    ui/
      results.js
      status.js
  data/
    geo-prefixes.json
  pages/
    privacy.html
    about.html
    contact.html
tests/
  domain.test.js
  parser.test.js
  fallback.test.js
  cache.test.js
public/
  robots.txt
  sitemap.xml
  favicon.ico
```

## 24. 核心接口

```javascript
async function resolveLocation(hostname, location) {
  const [a, aaaa] = await Promise.all([
    resolveRecord(hostname, "A", location.subnet),
    resolveRecord(hostname, "AAAA", location.subnet)
  ]);

  return mergeLocationResult(location, a, aaaa);
}
```

```javascript
async function resolveRecord(hostname, type, subnet) {
  const cacheKey = createCacheKey(
    preferredResolver(),
    hostname,
    type,
    subnet
  );

  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  return resolveWithFallback(hostname, type, subnet);
}
```

## 25. 开发顺序

1. 创建 Vite 静态项目和基础 UI。
2. 实现域名 normalize 和 validation。
3. 实现 Google resolver。
4. 实现 DNS JSON parser 和内部数据模型。
5. 加入 26 个地区配置。
6. 实现并发队列、逐行 rendering 和 cache。
7. 实现完整错误状态。
8. 实现 provider health 和熔断。
9. 实现 AliDNS resolver，并执行浏览器 smoke test。
10. 完成移动端和 accessibility。
11. 添加 SEO 静态内容和法律页面。
12. 添加 robots.txt 和 sitemap.xml。
13. 运行跨浏览器和中国大陆网络测试。
14. 部署 V1。

## 26. V1 上线标准

只有全部满足后才能上线：

- 26 个地区可查询
- A、AAAA、CNAME 正确解析
- TTL 不丢失
- mixed resolver 正确显示
- NXDOMAIN 不触发 fallback
- Google 不可用时不会造成每个请求重复等待
- AliDNS CORS 和匿名 ECS 在真实浏览器中验证通过
- 所有地区独立更新
- 手机端可用
- 隐私说明与真实实现一致
- 不包含任何 DNS provider 凭据
- resolver smoke test 通过
- 静态页面可被搜索引擎直接读取

## 27. 外部资料

- Google Public DNS JSON API:  
  https://developers.google.com/speed/public-dns/docs/doh/json
- Google Public DNS Terms:  
  https://developers.google.com/speed/public-dns/terms
- Alibaba Cloud HTTPDNS JSON API:  
  https://www.alibabacloud.com/help/en/dns/httpdns-doh-json-api
- Alibaba Cloud DoH:  
  https://www.alibabacloud.com/help/en/dns/httpdns-dns-over-https-doh
- DNSPod Public DNS:  
  https://cloud.tencent.com/document/product/302/40311
- RIPE Atlas API:  
  https://atlas.ripe.net/docs/apis/

## 28. 架构决策摘要

V1 默认采用：

```text
Static website
Google JSON DoH primary
AliDNS anonymous JSON fallback behind feature flag
Per-record resolver and TTL
Provider circuit breaker
No database
No user account
No query history
```

如果 AliDNS 匿名或 CORS 行为失效：

```text
Static website
Google JSON DoH primary
Small serverless fallback
DNSPod Public DNS primary fallback
360 Secure DNS secondary fallback
```

该方案在保持产品简单和低成本的同时，避免在前端暴露凭据，并为中国大陆网络环境保留可维护的替代路径。
