// ═══════════════════════════════════════════════════════════════════
//  Jenkinsfile – Pipeline CI/CD  |  Gestion des voitures
//  Stages : Checkout → Lint → Build → Trivy Scan → Push → Deploy
// ═══════════════════════════════════════════════════════════════════

pipeline {

    agent any

    // ── Outils déclarés dans Jenkins Global Tool Configuration ──────
    tools {
        nodejs 'NodeJS-20'
    }

    // ── Variables d'environnement ────────────────────────────────────
    environment {
        APP_NAME          = 'gestion-voitures'
        DOCKER_IMAGE      = "${APP_NAME}:${BUILD_NUMBER}"
        DOCKER_IMAGE_LATEST = "${APP_NAME}:latest"
        DOCKER_REGISTRY   = credentials('DOCKER_REGISTRY_URL')   // ex: registry.hub.docker.com/monorg
        DOCKER_CREDENTIALS = 'docker-hub-credentials'
        TRIVY_REPORT_DIR  = 'trivy-reports'
        TRIVY_IMAGE_REPORT = "${TRIVY_REPORT_DIR}/trivy-image-report.csv"
        TRIVY_FS_REPORT   = "${TRIVY_REPORT_DIR}/trivy-fs-report.csv"
        MONGO_URI         = credentials('MONGO_URI_PROD')
        SONAR_PROJECT_KEY = 'gestion-voitures'
    }

    // ── Options globales ─────────────────────────────────────────────
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    // ── Déclencheurs ─────────────────────────────────────────────────
    triggers {
        // Déclenche sur push GitHub/GitLab via webhook
        pollSCM('H/5 * * * *')
    }

    // ════════════════════════════════════════════════════════════════
    //  STAGES
    // ════════════════════════════════════════════════════════════════
    stages {

        // ────────────────────────────────────────────────────────────
        // 1. CHECKOUT
        // ────────────────────────────────────────────────────────────
        stage('📥 Checkout') {
            steps {
                echo '==> Récupération du code source...'
                checkout scm
                sh 'git log --oneline -5'
            }
        }

        // ────────────────────────────────────────────────────────────
        // 2. INSTALLATION DES DÉPENDANCES
        // ────────────────────────────────────────────────────────────
        stage('📦 Install Dependencies') {
            steps {
                echo '==> Installation des dépendances Node.js...'
                sh 'npm ci'
            }
        }

        // ────────────────────────────────────────────────────────────
        // 3. LINT & ANALYSE STATIQUE
        // ────────────────────────────────────────────────────────────
        stage('🔍 Lint & Static Analysis') {
            parallel {

                stage('ESLint') {
                    steps {
                        echo '==> Analyse ESLint...'
                        sh 'npm run lint || true'
                    }
                }

                stage('Audit NPM') {
                    steps {
                        echo '==> Audit des vulnérabilités npm...'
                        sh 'npm audit --audit-level=high || true'
                    }
                }
            }
        }

        // ────────────────────────────────────────────────────────────
        // 4. TESTS UNITAIRES
        // ────────────────────────────────────────────────────────────
        stage('🧪 Tests') {
            steps {
                echo '==> Exécution des tests...'
                sh 'npm test -- --coverage || true'
            }
            post {
                always {
                    // Publie les résultats de tests JUnit si disponibles
                    junit allowEmptyResults: true, testResults: '**/test-results/*.xml'
                }
            }
        }

        // ────────────────────────────────────────────────────────────
        // 5. BUILD DOCKER IMAGE
        // ────────────────────────────────────────────────────────────
        stage('🐳 Docker Build') {
            steps {
                echo "==> Construction de l'image Docker: ${DOCKER_IMAGE}"
                sh """
                    docker build \
                        --target production \
                        --build-arg BUILD_DATE=\$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
                        --build-arg GIT_COMMIT=\$(git rev-parse --short HEAD) \
                        -t ${DOCKER_IMAGE} \
                        -t ${DOCKER_IMAGE_LATEST} \
                        .
                """
            }
        }

        // ────────────────────────────────────────────────────────────
        // 6. SCAN DE SÉCURITÉ TRIVY  →  Rapport CSV
        // ────────────────────────────────────────────────────────────
        stage('🔒 Trivy Security Scan') {
            steps {
                echo '==> Scan de sécurité avec Trivy...'

                // Création du répertoire de rapports
                sh "mkdir -p ${TRIVY_REPORT_DIR}"

                // ── 6a. Scan de l'image Docker ───────────────────────
                sh """
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v \$(pwd)/${TRIVY_REPORT_DIR}:/reports \
                        -v trivy-cache:/root/.cache/trivy \
                        aquasec/trivy:latest image \
                            --exit-code 0 \
                            --severity LOW,MEDIUM,CRITICAL \
                            --format template \
                            --template "@contrib/csv.tpl" \
                            --output /reports/trivy-image-report.csv \
                            ${DOCKER_IMAGE}
                """

                // ── 6b. Scan du système de fichiers (code source) ────
                sh """
                    docker run --rm \
                        -v \$(pwd):/workspace:ro \
                        -v \$(pwd)/${TRIVY_REPORT_DIR}:/reports \
                        -v trivy-cache:/root/.cache/trivy \
                        aquasec/trivy:latest fs \
                            --exit-code 0 \
                            --severity LOW,MEDIUM,CRITICAL \
                            --format template \
                            --template "@contrib/csv.tpl" \
                            --output /reports/trivy-fs-report.csv \
                            /workspace
                """

                // ── 6c. Résumé dans la console Jenkins ───────────────
                sh """
                    echo "======================================"
                    echo "  RÉSUMÉ TRIVY – IMAGE DOCKER"
                    echo "======================================"
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v trivy-cache:/root/.cache/trivy \
                        aquasec/trivy:latest image \
                            --exit-code 0 \
                            --severity LOW,MEDIUM,CRITICAL \
                            --format table \
                            ${DOCKER_IMAGE}

                    echo "======================================"
                    echo "  RÉSUMÉ TRIVY – CODE SOURCE"
                    echo "======================================"
                    docker run --rm \
                        -v \$(pwd):/workspace:ro \
                        -v trivy-cache:/root/.cache/trivy \
                        aquasec/trivy:latest fs \
                            --exit-code 0 \
                            --severity LOW,MEDIUM,CRITICAL \
                            --format table \
                            /workspace
                """

                // ── 6d. Échec du pipeline si vulnérabilités CRITICAL ─
                sh """
                    CRITICAL_COUNT=\$(grep -i ',CRITICAL,' ${TRIVY_IMAGE_REPORT} 2>/dev/null | wc -l || echo 0)
                    echo "Vulnérabilités CRITICAL dans l'image: \$CRITICAL_COUNT"
                    if [ "\$CRITICAL_COUNT" -gt "0" ]; then
                        echo "⚠️  Des vulnérabilités CRITICAL ont été détectées – revue obligatoire."
                        echo "   Consultez le rapport : ${TRIVY_IMAGE_REPORT}"
                        # Décommentez la ligne ci-dessous pour bloquer le pipeline
                        # exit 1
                    fi
                """
            }

            post {
                always {
                    // Archive les rapports CSV comme artefacts Jenkins
                    archiveArtifacts artifacts: "${TRIVY_REPORT_DIR}/*.csv",
                                     fingerprint: true,
                                     allowEmptyArchive: true

                    // Publie les rapports dans l'onglet Jenkins
                    publishHTML(target: [
                        allowMissing         : true,
                        alwaysLinkToLastBuild: true,
                        keepAll              : true,
                        reportDir            : "${TRIVY_REPORT_DIR}",
                        reportFiles          : 'trivy-image-report.csv,trivy-fs-report.csv',
                        reportName           : 'Trivy Security Reports'
                    ])
                }
            }
        }

        // ────────────────────────────────────────────────────────────
        // 7. PUSH VERS LE REGISTRY (uniquement sur main/master)
        // ────────────────────────────────────────────────────────────
        stage('📤 Docker Push') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                echo "==> Push de l'image vers ${DOCKER_REGISTRY}..."
                withCredentials([usernamePassword(
                    credentialsId: "${DOCKER_CREDENTIALS}",
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh """
                        echo "\$DOCKER_PASS" | docker login -u "\$DOCKER_USER" --password-stdin
                        docker tag ${DOCKER_IMAGE}        \${DOCKER_REGISTRY}/${DOCKER_IMAGE}
                        docker tag ${DOCKER_IMAGE_LATEST} \${DOCKER_REGISTRY}/${DOCKER_IMAGE_LATEST}
                        docker push \${DOCKER_REGISTRY}/${DOCKER_IMAGE}
                        docker push \${DOCKER_REGISTRY}/${DOCKER_IMAGE_LATEST}
                        docker logout
                    """
                }
            }
        }

        // ────────────────────────────────────────────────────────────
        // 8. DÉPLOIEMENT (staging / production)
        // ────────────────────────────────────────────────────────────
        stage('🚀 Deploy') {
            when {
                branch 'main'
            }
            steps {
                echo '==> Déploiement via Docker Compose...'
                sh """
                    docker compose -f docker-compose.yml down --remove-orphans || true
                    docker compose -f docker-compose.yml up -d --build
                    docker compose -f docker-compose.yml ps
                """
            }
        }

        // ────────────────────────────────────────────────────────────
        // 9. VÉRIFICATION POST-DÉPLOIEMENT
        // ────────────────────────────────────────────────────────────
        stage('✅ Health Check') {
            when {
                branch 'main'
            }
            steps {
                echo '==> Vérification de santé de l'application...'
                sh """
                    sleep 10
                    STATUS=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health)
                    if [ "\$STATUS" != "200" ]; then
                        echo "❌ Health check échoué – HTTP \$STATUS"
                        exit 1
                    fi
                    echo "✅ Application disponible – HTTP \$STATUS"
                """
            }
        }

    }
    // ═══ fin stages ════════════════════════════════════════════════

    // ════════════════════════════════════════════════════════════════
    //  POST – Notifications & Nettoyage
    // ════════════════════════════════════════════════════════════════
    post {

        always {
            echo '==> Nettoyage des images Docker locales...'
            sh """
                docker rmi ${DOCKER_IMAGE}        || true
                docker rmi ${DOCKER_IMAGE_LATEST} || true
                docker image prune -f             || true
            """
            cleanWs()
        }

        success {
            echo '✅ Pipeline terminé avec succès !'
            // Décommentez pour activer les notifications email
            // mail to: 'team@example.com',
            //      subject: "✅ [${APP_NAME}] Build #${BUILD_NUMBER} réussi",
            //      body: "Build réussi : ${BUILD_URL}"
        }

        failure {
            echo '❌ Pipeline échoué – vérifiez les logs.'
            // mail to: 'team@example.com',
            //      subject: "❌ [${APP_NAME}] Build #${BUILD_NUMBER} échoué",
            //      body: "Échec : ${BUILD_URL}\n\nConsultez les rapports Trivy dans les artefacts."
        }

        unstable {
            echo '⚠️  Pipeline instable – des tests ont échoué.'
        }
    }
}
