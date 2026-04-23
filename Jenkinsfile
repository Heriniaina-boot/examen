pipeline {

    agent any

    environment {
        APP_NAME             = 'gestion-voitures'
        DOCKER_IMAGE         = "${APP_NAME}:${BUILD_NUMBER}"
        DOCKER_IMAGE_LATEST  = "${APP_NAME}:latest"
        DOCKER_CREDENTIALS   = 'docker-hub-credentials'
        TRIVY_REPORT_DIR     = 'trivy-reports'
        TRIVY_IMAGE_REPORT   = "${TRIVY_REPORT_DIR}/trivy-image-report.csv"
        TRIVY_FS_REPORT      = "${TRIVY_REPORT_DIR}/trivy-fs-report.csv"
    }

    
    stages { 
        stage('Checkout') { 
            steps { 
                git 'https://github.com/Heriniaina-boot/examen.git' 
            } 
        } 
    } 
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {

        stage('Checkout') {
            steps {
                echo '==> Checkout du code source'
                checkout scm
                sh 'git log --oneline -5'
            }
        }

        stage('Check Node') {
            steps {
                echo '==> Verification de Node.js'
                sh 'node --version'
                sh 'npm --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '==> Installation des dependances npm'
                sh 'npm ci'
            }
        }

        stage('Lint and Audit') {
            parallel {
                stage('ESLint') {
                    steps {
                        echo '==> ESLint'
                        sh 'npm run lint || true'
                    }
                }
                stage('NPM Audit') {
                    steps {
                        echo '==> npm audit'
                        sh 'npm audit --audit-level=high || true'
                    }
                }
            }
        }

        stage('Tests') {
            steps {
                echo '==> Tests unitaires'
                sh 'npm test -- --coverage || true'
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: '**/test-results/*.xml'
                }
            }
        }

        stage('Docker Build') {
            steps {
                echo "==> Build image Docker : ${DOCKER_IMAGE}"
                sh """
                    docker build \\
                        --target production \\
                        --build-arg BUILD_DATE=\$(date -u +%Y-%m-%dT%H:%M:%SZ) \\
                        --build-arg GIT_COMMIT=\$(git rev-parse --short HEAD) \\
                        -t ${DOCKER_IMAGE} \\
                        -t ${DOCKER_IMAGE_LATEST} \\
                        .
                """
            }
        }

        stage('Trivy Security Scan') {
            steps {
                echo '==> Scan de securite Trivy'
                sh "mkdir -p ${TRIVY_REPORT_DIR}"

                sh """
                    docker run --rm \\
                        -v /var/run/docker.sock:/var/run/docker.sock \\
                        -v \$(pwd)/${TRIVY_REPORT_DIR}:/reports \\
                        -v trivy-cache:/root/.cache/trivy \\
                        aquasec/trivy:latest image \\
                            --exit-code 0 \\
                            --severity LOW,MEDIUM,CRITICAL \\
                            --format template \\
                            --template "@contrib/csv.tpl" \\
                            --output /reports/trivy-image-report.csv \\
                            ${DOCKER_IMAGE}
                """

                sh """
                    docker run --rm \\
                        -v \$(pwd):/workspace:ro \\
                        -v \$(pwd)/${TRIVY_REPORT_DIR}:/reports \\
                        -v trivy-cache:/root/.cache/trivy \\
                        aquasec/trivy:latest fs \\
                            --exit-code 0 \\
                            --severity LOW,MEDIUM,CRITICAL \\
                            --format template \\
                            --template "@contrib/csv.tpl" \\
                            --output /reports/trivy-fs-report.csv \\
                            /workspace
                """

                sh """
                    echo "====== TRIVY IMAGE REPORT ======"
                    docker run --rm \\
                        -v /var/run/docker.sock:/var/run/docker.sock \\
                        -v trivy-cache:/root/.cache/trivy \\
                        aquasec/trivy:latest image \\
                            --exit-code 0 \\
                            --severity LOW,MEDIUM,CRITICAL \\
                            --format table \\
                            ${DOCKER_IMAGE}

                    echo "====== TRIVY FS REPORT ======"
                    docker run --rm \\
                        -v \$(pwd):/workspace:ro \\
                        -v trivy-cache:/root/.cache/trivy \\
                        aquasec/trivy:latest fs \\
                            --exit-code 0 \\
                            --severity LOW,MEDIUM,CRITICAL \\
                            --format table \\
                            /workspace
                """

                sh """
                    CRITICAL_COUNT=\$(grep -i ',CRITICAL,' ${TRIVY_IMAGE_REPORT} 2>/dev/null | wc -l || echo 0)
                    echo "Vulnerabilites CRITICAL detectees : \$CRITICAL_COUNT"
                    if [ "\$CRITICAL_COUNT" -gt "0" ]; then
                        echo "ATTENTION : vulnerabilites CRITICAL trouvees - voir rapport CSV"
                    fi
                """
            }

            post {
                always {
                    archiveArtifacts artifacts: "${TRIVY_REPORT_DIR}/*.csv",
                                     fingerprint: true,
                                     allowEmptyArchive: true
                }
            }
        }

        stage('Docker Push') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                echo '==> Push vers le registry Docker'
                withCredentials([usernamePassword(
                    credentialsId: "${DOCKER_CREDENTIALS}",
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh """
                        echo "\$DOCKER_PASS" | docker login -u "\$DOCKER_USER" --password-stdin
                        docker push ${DOCKER_IMAGE}
                        docker push ${DOCKER_IMAGE_LATEST}
                        docker logout
                    """
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                echo '==> Deploiement Docker Compose'
                sh """
                    docker compose -f docker-compose.yml down --remove-orphans || true
                    docker compose -f docker-compose.yml up -d --build
                    docker compose -f docker-compose.yml ps
                """
            }
        }

        stage('Health Check') {
            when {
                branch 'main'
            }
            steps {
                echo '==> Verification sante application'
                sh """
                    sleep 10
                    STATUS=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health)
                    if [ "\$STATUS" != "200" ]; then
                        echo "Health check echoue - HTTP \$STATUS"
                        exit 1
                    fi
                    echo "Application OK - HTTP \$STATUS"
                """
            }
        }

    }

    post {
        always {
            echo '==> Nettoyage images Docker'
            sh """
                docker rmi ${DOCKER_IMAGE}        || true
                docker rmi ${DOCKER_IMAGE_LATEST} || true
                docker image prune -f             || true
            """
            cleanWs()
        }
        success {
            echo '==> Pipeline termine avec succes'
        }
        failure {
            echo '==> Pipeline en echec - voir les logs'
        }
        unstable {
            echo '==> Pipeline instable'
        }
    }
}
