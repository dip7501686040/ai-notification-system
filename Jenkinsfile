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
  // Kubernetes-plugin pod agent, not `agent any` -- Jenkins runs as a k8s
  // workload (see platform-gitops/k8s/jenkins/values.yaml), and the k3s
  // node it schedules onto has no docker.sock to give a build agent. This
  // step used to `docker run node:24 ...` against the Jenkins EC2 host's
  // own docker (leftover from before that EC2->k8s migration) -- same class
  // of problem platform-gitops/jenkins/Jenkinsfile's kaniko container
  // already solves for the actual image builds; mirrored here for this
  // step's own node:24 need instead of shelling out to a nonexistent
  // docker binary. The Kubernetes plugin mounts the same workspace volume
  // into every container in the pod, so the node container below sees the
  // checked-out repo with no explicit -v/-w mount needed.
  agent {
    kubernetes {
      yaml '''
        apiVersion: v1
        kind: Pod
        spec:
          containers:
          - name: node
            image: node:24
            command: ["sleep"]
            args: ["99d"]
            resources:
              requests: { cpu: 250m, memory: 512Mi }
              limits: { cpu: 1000m, memory: 1Gi }
      '''
      defaultContainer 'jnlp'
    }
  }

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
          // fetches just the turbo binary itself. Runs inside the pod's own
          // node:24 container (the engines.node this repo requires) --
          // no docker daemon needed or available. No persistent pnpm store
          // mount either (the old docker-run version had one) -- this pod
          // is single-use per build, same as the kaniko pods in
          // platform-gitops/jenkins/Jenkinsfile, and this dry-run is a
          // metadata-only diff, not a real build, so losing that cache
          // doesn't cost much.
          def dryRun = container('node') {
            sh(
              script: """
                # Turbo shells out to git internally to resolve the --filter
                # diff. The workspace here is checked out by Jenkins' own
                # git step (a different UID than this node:24 container
                # runs as), which trips git's post-CVE-2022-24765
                # dubious-ownership guard the moment turbo touches it.
                # Wildcarded, not the literal path: the workspace path
                # embeds the job name, which differs per job.
                git config --global --add safe.directory '*'
                corepack enable
                pnpm config set store-dir /tmp/pnpm-store
                # Must track package.json's own "turbo": "^2.3.0" range, not
                # a hard pin -- 2.3.0 exactly predates the top-level
                # `concurrency` key this repo's turbo.json already uses,
                # so a pinned dlx install fails to parse it even though a
                # real `pnpm install` here resolves it fine.
                pnpm dlx turbo@^2.3.0 run build --filter="...[${baseSha}]" --dry=json
              """,
              returnStdout: true
            ).trim()
          }

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
