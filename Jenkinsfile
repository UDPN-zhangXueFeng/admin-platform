// ─────────────────────────────────────────────────────────────
// admin-platform 部署流水线（参考 td-manage/Jenkinsfile）
// 形态：Jenkins(DooD) → docker-compose 起 app(Next.js standalone) + nginx(反代/aps)
//      app 镜像环境无关，nginx 镜像按后端地址单独 build。
// ─────────────────────────────────────────────────────────────

pipeline {
    agent any

    parameters {
        gitParameter(
            name: 'BRANCH_NAME',
            type: 'PT_BRANCH',
            branchFilter: 'origin/(.*)',
            defaultValue: 'main',
            description: '选择要构建的分支',
            selectedValue: 'DEFAULT',
            sortMode: 'ASCENDING_SMART',
            quickFilterEnabled: true,
            listSize: '10'
        )

        choice(
            name: 'ENV_NAME',
            choices: ['main'],
            description: '部署环境，端口见 portMap（当前 main → 6241；新增环境时在此追加并同步下方 portMap）'
        )

        string(
            name: 'SERVER_HOST',
            defaultValue: '10.0.7.20',
            description: '对外访问的服务器地址（用于生成访问链接）'
        )

        choice(
            name: 'NEXT_SERVICE_SERVER_URL',
            choices: [
                'http://10.0.48.120:30001',
                'http://10.0.48.123:30001'
            ],
            description: '后端 API 地址（注入到 nginx，代理 /aps/*）'
        )

        booleanParam(name: 'CLEAN_IMAGES', defaultValue: false, description: '是否在部署成功后清理未使用的 Docker 镜像（默认关闭以保留构建缓存）')
        booleanParam(name: 'ONLY_SHOW_INFO', defaultValue: false, description: '勾选后只展示当前所有环境信息，不执行部署')

        string(
            name: 'FEISHU_WEBHOOK',
            defaultValue: 'https://open.feishu.cn/open-apis/bot/v2/hook/392d5fb9-0a48-467a-b1b3-d74e5d2d1f8a',
            description: '飞书机器人 Webhook 地址'
        )
    }

    tools {
        nodejs 'nodejs'
    }

    environment {
        BUILD_TIME = sh(script: "date '+%Y-%m-%d %H:%M:%S'", returnStdout: true).trim()
        BUILD_USER = "${env.BUILD_USER_ID ?: 'Jenkins'}"
    }

    stages {
        stage('收集所有环境信息') {
            steps {
                script {
                    // 环境名 → 端口；新增环境在此追加
                    def portMap = ['main': '6241']
                    env.NGINX_PORT = portMap[params.ENV_NAME] ?: '6241'
                    echo "🔌 环境 [${params.ENV_NAME}] 对应端口: ${env.NGINX_PORT}"

                    env.ALL_ENVS_INFO = sh(script: collectEnvsScript(), returnStdout: true).trim()
                    printEnvTable()

                    if (params.ONLY_SHOW_INFO) {
                        echo "✅ 信息查看完成，跳过部署步骤"
                        sendFeishuNotification('info')
                        currentBuild.result = 'SUCCESS'
                        return
                    }
                }
            }
        }

        stage('参数验证') {
            when { expression { !params.ONLY_SHOW_INFO } }
            steps {
                script {
                    echo "========================================="
                    echo "📋 本次构建参数"
                    echo "========================================="
                    echo "🌿 分支:   ${params.BRANCH_NAME}"
                    echo "🏷️  环境:   ${params.ENV_NAME}"
                    echo "🖥️  服务器: ${params.SERVER_HOST}"
                    echo "🔌 端口:   ${env.NGINX_PORT}"
                    echo "🌐 后端:   ${params.NEXT_SERVICE_SERVER_URL}"
                    echo "👤 构建人: ${env.BUILD_USER}"
                    echo "⏰ 时间:   ${env.BUILD_TIME}"
                    echo "========================================="

                    def portInUse = sh(
                        script: "docker ps --format '{{.Names}}|{{.Ports}}' | grep '0.0.0.0:${env.NGINX_PORT}' | grep -v 'admin-platform-${params.ENV_NAME}-nginx' || echo ''",
                        returnStdout: true
                    ).trim()
                    if (portInUse) {
                        echo "⚠️ 端口 ${env.NGINX_PORT} 已被其他容器占用：${portInUse}"
                        input message: "端口已被占用，是否继续？", ok: '继续部署'
                    }
                }
            }
        }

        stage('下载代码') {
            when { expression { !params.ONLY_SHOW_INFO } }
            steps {
                checkout scmGit(
                    branches: [[name: "${params.BRANCH_NAME}"]],
                    extensions: [],
                    userRemoteConfigs: [[
                        // GitHub PAT 凭证（已在 Jenkins 配置，id = github-pat）
                        credentialsId: 'github-pat',
                        url: 'https://github.com/UDPN-zhangXueFeng/admin-platform.git'
                    ]]
                )
                script {
                    env.GIT_COMMIT_MSG    = sh(script: 'git log -1 --pretty=%B',    returnStdout: true).trim()
                    env.GIT_COMMIT_AUTHOR = sh(script: 'git log -1 --pretty=%an',   returnStdout: true).trim()
                    env.GIT_COMMIT_HASH   = sh(script: 'git log -1 --pretty=%h',    returnStdout: true).trim()
                    env.APP_IMAGE_TAG     = "admin-platform-app:${env.GIT_COMMIT_HASH}"
                    echo "📝 ${env.GIT_COMMIT_HASH} by ${env.GIT_COMMIT_AUTHOR}: ${env.GIT_COMMIT_MSG}"
                    echo "🐳 App 镜像标签: ${env.APP_IMAGE_TAG}"
                }
            }
        }

        stage('检查工具版本') {
            when { expression { !params.ONLY_SHOW_INFO } }
            steps {
                sh 'node -v'
                sh 'docker -v'
                sh 'docker buildx version'
                sh 'docker-compose -v'
            }
        }

        stage('构建镜像') {
            when { expression { !params.ONLY_SHOW_INFO } }
            steps {
                script {
                    def projectName = "admin-platform-${params.ENV_NAME}"
                    echo "🔨 构建镜像: ${projectName}（后端 ${params.NEXT_SERVICE_SERVER_URL}）"
                    sh """
                        export COMPOSE_PROJECT_NAME=${projectName}
                        export NGINX_PORT=${env.NGINX_PORT}
                        export NEXT_SERVICE_SERVER_URL=${params.NEXT_SERVICE_SERVER_URL}
                        export APP_IMAGE_TAG=${env.APP_IMAGE_TAG}
                        export ENV_NAME=${params.ENV_NAME}
                        export GIT_BRANCH=${params.BRANCH_NAME}
                        export BUILD_TIME="${env.BUILD_TIME}"
                        export BUILD_USER="${env.BUILD_USER}"
                        export DOCKER_BUILDKIT=1
                        export COMPOSE_DOCKER_CLI_BUILD=1

                        if docker image inspect "${env.APP_IMAGE_TAG}" >/dev/null 2>&1; then
                            echo "♻️  复用已有 app 镜像: ${env.APP_IMAGE_TAG}"
                        else
                            docker-compose build app
                        fi
                        docker-compose build nginx
                    """
                }
            }
        }

        stage('切换容器') {
            when { expression { !params.ONLY_SHOW_INFO } }
            steps {
                script {
                    def projectName = "admin-platform-${params.ENV_NAME}"
                    echo "🚀 切换容器: ${projectName}（端口 ${env.NGINX_PORT}:80）"
                    sh """
                        export COMPOSE_PROJECT_NAME=${projectName}
                        export NGINX_PORT=${env.NGINX_PORT}
                        export NEXT_SERVICE_SERVER_URL=${params.NEXT_SERVICE_SERVER_URL}
                        export APP_IMAGE_TAG=${env.APP_IMAGE_TAG}
                        export ENV_NAME=${params.ENV_NAME}
                        export GIT_BRANCH=${params.BRANCH_NAME}
                        export BUILD_TIME="${env.BUILD_TIME}"
                        export BUILD_USER="${env.BUILD_USER}"

                        docker-compose up -d --force-recreate --remove-orphans
                    """
                }
            }
        }

        stage('验证部署') {
            when { expression { !params.ONLY_SHOW_INFO } }
            steps {
                script {
                    def projectName = "admin-platform-${params.ENV_NAME}"
                    sh "export COMPOSE_PROJECT_NAME=${projectName} && docker-compose ps"
                    sleep(time: 8, unit: 'SECONDS')
                    def appStatus = sh(
                        script: "docker ps --filter 'name=${projectName}-app' --format '{{.Status}}'",
                        returnStdout: true
                    ).trim()
                    def nginxStatus = sh(
                        script: "docker ps --filter 'name=${projectName}-nginx' --format '{{.Status}}'",
                        returnStdout: true
                    ).trim()
                    if (appStatus.contains('Up') && nginxStatus.contains('Up')) {
                        echo "✅ app + nginx 运行正常"
                        env.DEPLOY_STATUS = 'success'
                    } else {
                        echo "⚠️ 容器状态异常 → app: ${appStatus}; nginx: ${nginxStatus}"
                        env.DEPLOY_STATUS = 'warning'
                    }
                }
            }
        }

        stage('收集最新环境信息') {
            when { expression { !params.ONLY_SHOW_INFO } }
            steps {
                script {
                    env.ALL_ENVS_INFO = sh(script: collectEnvsScript(), returnStdout: true).trim()
                }
            }
        }

        stage('清理镜像') {
            when {
                allOf {
                    expression { !params.ONLY_SHOW_INFO }
                    expression { params.CLEAN_IMAGES }
                }
            }
            steps {
                sh 'docker image prune -f || true'
            }
        }

        stage('发送飞书通知') {
            steps {
                script {
                    if (!env.DEPLOY_STATUS && !params.ONLY_SHOW_INFO) { env.DEPLOY_STATUS = 'success' }
                    sendFeishuNotification(params.ONLY_SHOW_INFO ? 'info' : 'deploy')
                }
            }
        }
    }

    post {
        success {
            script {
                if (!params.ONLY_SHOW_INFO) {
                    echo "✅ 构建部署成功！访问: http://${params.SERVER_HOST}:${env.NGINX_PORT}"
                }
            }
        }
        failure {
            script {
                echo "❌ 构建部署失败！"
                env.DEPLOY_STATUS = 'failed'
                sendFeishuNotification('failed')
            }
        }
    }
}

// ── 枚举所有 admin-platform 环境（nginx 容器）──
// 输出格式：环境名|端口|后端地址|分支|构建时间|状态
def collectEnvsScript() {
    return '''#!/bin/bash
        containers=$(docker ps -a --filter "name=admin-platform" --format "{{.Names}}" | grep "nginx" | sort)
        if [ -z "$containers" ]; then exit 0; fi
        for container in $containers; do
            env_name=$(echo "$container" | sed 's/admin-platform-\\(.*\\)-nginx/\\1/')
            port=$(docker port "$container" 80 2>/dev/null | grep -oE '[0-9]+$' | head -1); [ -z "$port" ] && port="N/A"
            api_url=$(docker inspect "$container" --format '{{index .Config.Labels "admin-platform.api-url"}}' 2>/dev/null)
            [ -z "$api_url" ] || [ "$api_url" = "<no value>" ] && api_url="N/A"
            branch=$(docker inspect "$container" --format '{{index .Config.Labels "admin-platform.branch"}}' 2>/dev/null)
            [ -z "$branch" ] || [ "$branch" = "<no value>" ] && branch="N/A"
            build_time=$(docker inspect "$container" --format '{{index .Config.Labels "admin-platform.build-time"}}' 2>/dev/null)
            [ -z "$build_time" ] || [ "$build_time" = "<no value>" ] && build_time="N/A"
            status=$(docker inspect "$container" --format '{{.State.Status}}' 2>/dev/null); [ -z "$status" ] && status="N/A"
            printf "%s|%s|%s|%s|%s|%s\\n" "$env_name" "$port" "$api_url" "$branch" "$build_time" "$status"
        done
    '''
}

// 打印环境信息表
def printEnvTable() {
    if (!env.ALL_ENVS_INFO) {
        echo "⚠️ 当前没有运行中的 admin-platform 环境"
        return
    }
    echo "┌──────────┬──────┬────────────────────────┬──────────────────┬─────────────────────┬────────┐"
    echo "│ 环境     │ 端口 │ 后端地址               │ 分支             │ 构建时间            │ 状态   │"
    echo "├──────────┼──────┼────────────────────────┼──────────────────┼─────────────────────┼────────┤"
    env.ALL_ENVS_INFO.split('\n').each { line ->
        if (line.trim() && line.contains('|')) {
            def p = line.split('\\|', -1)
            if (p.size() >= 6) {
                echo "│ ${p[0].take(8).padRight(8)} │ ${p[1].take(4).padRight(4)} │ ${p[2].take(22).padRight(22)} │ ${p[3].take(16).padRight(16)} │ ${p[4].take(19).padRight(19)} │ ${p[5].take(6).padRight(6)} │"
            }
        }
    }
    echo "└──────────┴──────┴────────────────────────┴──────────────────┴─────────────────────┴────────┘"
}

// 飞书通知（精简版：deploy / failed / info）
def sendFeishuNotification(String type) {
    def webhook = params.FEISHU_WEBHOOK
    if (!webhook || webhook.contains('your-webhook-key')) {
        echo "⚠️ 未配置飞书 Webhook，跳过通知"
        return
    }

    def color = 'blue'
    def title = ''
    def fields = ""
    def envInfo = formatEnvInfo()

    if (type == 'failed') {
        color = 'red'; title = '❌ admin-platform 部署失败'
    } else if (type == 'info') {
        color = 'blue'; title = '📋 admin-platform 环境信息查询'
    } else {
        color = (env.DEPLOY_STATUS == 'success') ? 'green' : 'orange'
        title = (env.DEPLOY_STATUS == 'success') ? '✅ admin-platform 部署成功' : '⚠️ admin-platform 部署完成（有警告）'
    }

    // 通用字段（非 info 时附带）
    if (type != 'info') {
        def commitMsg = (env.GIT_COMMIT_MSG ?: 'N/A').replaceAll(/["\\\r\n]+/, ' ').take(120)
        fields = """
      {{
        "tag": "div",
        "fields": [
          {{ "is_short": true, "text": {{ "tag": "lark_md", "content": "**🏷️ 环境**\\n${params.ENV_NAME}" }} }},
          {{ "is_short": true, "text": {{ "tag": "lark_md", "content": "**🖥️ 服务器**\\n${params.SERVER_HOST}" }} }},
          {{ "is_short": true, "text": {{ "tag": "lark_md", "content": "**🔌 端口**\\n${env.NGINX_PORT}" }} }},
          {{ "is_short": true, "text": {{ "tag": "lark_md", "content": "**🌿 分支**\\n${params.BRANCH_NAME}" }} }},
          {{ "is_short": true, "text": {{ "tag": "lark_md", "content": "**📝 提交**\\n${env.GIT_COMMIT_HASH ?: 'N/A'}" }} }},
          {{ "is_short": true, "text": {{ "tag": "lark_md", "content": "**👤 构建人**\\n${env.BUILD_USER}" }} }},
          {{ "is_short": true, "text": {{ "tag": "lark_md", "content": "**🌐 后端**\\n${params.NEXT_SERVICE_SERVER_URL}" }} }},
          {{ "is_short": true, "text": {{ "tag": "lark_md", "content": "**💬 提交信息**\\n${commitMsg}" }} }}
        ]
      }},
"""
    }

    def accessBtn = (type == 'failed') ? '' : """
      {{
        "tag": "action",
        "actions": [
          {{ "tag": "button", "type": "default", "text": {{ "tag": "plain_text", "content": "🌐 访问应用" }}, "url": "http://${params.SERVER_HOST}:${env.NGINX_PORT}" }},
          {{ "tag": "button", "type": "primary", "text": {{ "tag": "plain_text", "content": "📋 查看构建" }}, "url": "${env.BUILD_URL}" }}
        ]
      }},"""

    def content = """{
  "msg_type": "interactive",
  "card": {
    "header": {{ "title": {{ "content": "${title}", "tag": "plain_text" }}, "template": "${color}" }},
    "elements": [
${fields}
      {{ "tag": "hr" }},
      {{ "tag": "div", "text": {{ "tag": "lark_md", "content": "**📊 当前所有环境**\\n${envInfo}" }} }}${accessBtn}
    ]
  }
}"""

    try {
        sh """
            curl -s -X POST '${webhook}' \\
                -H 'Content-Type: application/json' \\
                -d '${content.replaceAll("'", "'\\''")}' \\
                || echo "飞书通知发送失败"
        """
        echo "✅ 飞书通知已发送（${type}）"
    } catch (Exception e) {
        echo "⚠️ 飞书通知发送失败: ${e.message}"
    }
}

// 格式化环境信息为 markdown
def formatEnvInfo() {
    if (!env.ALL_ENVS_INFO?.trim()) { return "暂无运行中的环境" }
    def result = ""
    env.ALL_ENVS_INFO.split('\n').findAll { it.trim() && it.contains('|') && it.split('\\|').size() >= 6 }.eachWithIndex { line, i ->
        def p = line.split('\\|', -1)
        if (!p[0] || p[0] == 'N/A' || !p[1]?.isInteger()) { return }
        def marker = (p[0] == params.ENV_NAME && !params.ONLY_SHOW_INFO) ? "🆕 " : "• "
        result += "${marker}**${p[0].toUpperCase()}**  端口 ${p[1]}  后端 ${p[2]}  分支 ${p[3]}  状态 ${p[5]}\\n"
    }
    return result ?: "暂无有效环境信息"
}
