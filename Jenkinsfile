// Thin CI trigger only. Uses Jenkins' built-in SCM trigger (pollSCM) —
// a cheap check for whether main moved; the actual turbo/build work below
// only runs when it did, never on a tick where nothing changed. On real
// AWS, point a GitHub webhook at this Jenkins' /git/notifyCommit?url=...
// (built into the Git plugin, no extra plugin needed) to make that check
// fire instantly on push instead of waiting for the next poll — pollSCM
// stays configured either way as the fallback.
//
// On a real change, asks Turborepo which packages are actually affected —
// dependency-graph aware, so a change to a shared packages/* library
// correctly marks every service that depends on it, not just literal
// apps/<service>/ path matches. Triggers build-<service> (defined in
// platform-gitops) one at a time for whatever's affected, in order, never
// in parallel, never for anything unaffected.
//
// The actual build/push/tag-bump logic stays in platform-gitops — this
// job only decides *what* needs building, using a capability (changeset
// tracking via GIT_PREVIOUS_SUCCESSFUL_COMMIT) that only works when this
// repo is the job's primary SCM.

pipeline {
  agent any

  // Only takes effect after this Jenkinsfile has run once — a declarative
  // triggers{} block is registered from the *previous* run, not the one
  // about to happen. Click "Build Now" once after this job is first
  // seeded; every run after that is self-scheduling.
  triggers {
    pollSCM('H/2 * * * *')
  }

  parameters {
    choice(name: 'ENVIRONMENT', choices: ['local', 'prod'], description: 'Which environment build-<service> should deploy to')
  }

  stages {
    stage('Determine affected services') {
      steps {
        script {
          def baseSha = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT
          if (!baseSha) {
            echo "No previous successful build to diff against (first run, or the last one failed) — recording this as the baseline without building anything."
            return
          }

          // No `pnpm install` needed — turbo resolves the workspace graph
          // straight from package.json + pnpm-lock.yaml, and `pnpm dlx`
          // fetches just the turbo binary itself. Runs inside node:24 (the
          // engines.node this repo requires) via the Jenkins EC2 host's
          // own docker, same daemon docker build/push already use — no
          // extra install needed on the instance itself.
          def dryRun = sh(
            script: """
              docker run --rm \\
                -v "\$PWD":/repo -w /repo \\
                -v /var/lib/jenkins/pnpm-store:/pnpm-store \\
                node:24 sh -c '
                  corepack enable
                  pnpm config set store-dir /pnpm-store
                  pnpm dlx turbo@2.3.0 run build --filter="...[${baseSha}]" --dry=json
                '
            """,
            returnStdout: true
          ).trim()

          def affectedServices = parseAffectedServices(dryRun)

          if (affectedServices.isEmpty()) {
            echo "No affected services since ${baseSha} — nothing to build."
          } else {
            echo "Affected services: ${affectedServices.join(', ')} — building one at a time, not in parallel."
            for (svc in affectedServices) {
              echo "Building ${svc}..."
              build job: "build-${svc}", wait: true, parameters: [
                string(name: 'ENVIRONMENT', value: params.ENVIRONMENT),
                string(name: 'SERVICES', value: svc),
              ]
            }
          }
        }
      }
    }
  }
}

// JsonSlurper keeps non-serializable state, which breaks Pipeline's CPS
// transform unless isolated in a @NonCPS method — and doing it this way
// avoids needing the Pipeline Utility Steps plugin's readJSON step, which
// this project has otherwise avoided adding (see the shared Jenkinsfile's
// own note about avoiding extra plugin dependencies).
@NonCPS
def parseAffectedServices(String turboDryRunJson) {
  def data = new groovy.json.JsonSlurper().parseText(turboDryRunJson)
  return data.packages
    .findAll { it != '//' }
    .collect { it.replaceFirst('^@ai-notification/', '') }
}
