pipeline {

    agent any

    environment {
        APP_NAME             = 'gestion-voitures'
        DOCKER_IMAGE         = "${APP_NAME}:${BUILD_NUMBER}"
        DOCKER_IMAGE_LATEST  = "${APP_NAME}:latest"
        DOCKER_CREDENTIALS   = 'docker-hub-credentials'
        TRIVY_REPORT_DIR     = 'trivy-reports'
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
                echo '📥 Checkout du code source'
                git 'https://github.com/Heriniaina-boot/examen.git'
                sh 'git log --oneline -5'
            }
        }

        stage('Check Tools') {
            steps {
                echo '🔍 Vérification Node & npm'
                sh 'node --version'
                sh 'npm --version'
                sh 'docker --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '📦 Installation des dépendances'
                sh 'npm ci'
            }
        }

        stage('Lint') {
            steps {
                echo '🧹 Lint code'
                sh 'npm run lint || true'
            }
        }

        stage('Tests') {
            steps {
                echo '🧪 Tests unitaires'
                sh 'npm test -- --coverage || true'
            }
        }

        stage('Docker Build') {
            steps {
                echo "🐳 Build image Docker : ${DOCKER_IMAGE}"
                sh """
                    docker build \
                        -t ${DOCKER_IMAGE} \
                        -t ${DOCKER_IMAGE_LATEST} \
                        .
                """
            }
        }

        stage('Trivy Scan') {
            steps {
                echo '🛡 Scan sécurité Trivy'
                sh "mkdir -p ${TRIVY_REPORT_DIR}"

                sh """
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        aquasec/trivy:latest image \
                        --severity HIGH,CRITICAL \
                        --format table \
                        ${DOCKER_IMAGE}
                """
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                echo '🚀 Déploiement avec Docker Compose'
                sh """
                    docker compose down || true
                    docker compose up -d --build
                    docker compose ps
                """
            }
        }

        stage('Health Check') {
            when {
                branch 'main'
            }
            steps {
                echo '❤️ Health check application'
                sh """
                    sleep 10
                    curl -f http://localhost:3000/health || exit 1
                """
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline réussi'
        }

        failure {
            echo '❌ Pipeline échoué'
        }

        always {
            echo '🧹 Nettoyage workspace'
            cleanWs()
        }
    }
}
