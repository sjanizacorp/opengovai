#!/usr/bin/env bash
# Also sourced by deploy.sh in the source distribution.
setup_note() {
    printf '%s\n' "$*"
    printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$SETUP_LOG"
}

setup_step() {
    local part=$1 bar='' i
    shift
    for ((i=0; i<10; i++)); do
        if (( i < part * 10 / 6 )); then bar+='#'; else bar+='-'; fi
    done
    setup_note "[$bar] $((part * 100 / 6))% $*"
}

setup_die() { setup_note "Setup stopped. $*"; exit 1; }

setup_setting() { grep -Eq "^[[:space:]]*$1[[:space:]]*=" .env; }

setup_prompt_local() {
    local host=$1 choice endpoint model default
    [[ $SETUP_INTERACTIVE == true ]] || return 0
    if setup_setting OPENGOVAI_POLICY_AI_LOCAL_URL || setup_setting OPENGOVAI_POLICY_AI_LOCAL_MODEL; then
        setup_note 'Local policy model settings already exist in .env.'
        return 0
    fi
    printf '\nOptional local language model for policy imports\n  1) Ollama\n  2) LM Studio\n  3) Other OpenAI-compatible server\n  Enter) Set up later\n'
    while true; do
        read -r -p 'Choose a model server [1/2/3/Enter]: ' choice || setup_die 'Input was closed.'
        case "$choice" in
            '') return 0 ;;
            1) default="http://$host:11434/v1"; break ;;
            2) default="http://$host:1234/v1"; break ;;
            3) default=''; break ;;
            *) printf 'Enter 1, 2, 3, or press Enter to skip.\n' ;;
        esac
    done
    printf '%s\n' 'Start the model server and load a local model. Its API must be reachable from OpenGovAI.'
    while true; do
        read -r -p "OpenAI-compatible base URL${default:+ [$default]}: " endpoint || setup_die 'Input was closed.'
        endpoint=${endpoint:-$default}
        if [[ "$endpoint" =~ ^https?://[a-zA-Z0-9][a-zA-Z0-9:/._-]*$ && ${#endpoint} -le 600 ]]; then break; fi
        printf 'Enter an HTTP or HTTPS base URL such as http://model-host:11434/v1.\n'
    done
    while true; do
        read -r -p 'Model ID as shown by your server: ' model || setup_die 'Input was closed.'
        if [[ "$model" =~ ^[a-zA-Z0-9][a-zA-Z0-9._:/+@-]*$ && ${#model} -le 200 ]]; then break; fi
        printf 'Enter a model ID from your server, such as the name shown by ollama list.\n'
    done
    printf '\nOPENGOVAI_POLICY_AI_LOCAL_URL=%s\nOPENGOVAI_POLICY_AI_LOCAL_MODEL=%s\n' "$endpoint" "$model" >> .env
    setup_note "Saved local model $model at $endpoint."
}

setup_read_secret() (
    local terminal_mode value
    terminal_mode=$(stty -g) || exit 1
    trap 'stty "$terminal_mode" 2>/dev/null || true' EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    stty -echo || exit 1
    printf '%s' "$1" >&2
    IFS= read -r value || exit 1
    printf '\n' >&2
    printf '%s' "$value"
)

setup_admin() {
    local status username unit password confirmation message
    status=$("$@" setup-status 2>> "$SETUP_LOG") || setup_die 'Could not read administrator status. See setup.log.'
    case "$status" in
        configured) setup_note 'Existing administrator preserved.'; return 0 ;;
        unconfigured) ;;
        *) setup_die 'Invalid administrator status returned by the application.' ;;
    esac
    if [[ ${SETUP_SKIP_ADMIN:-false} == true ]]; then
        setup_note 'Administrator creation skipped. Provision an administrator before signing in.'
        return 0
    fi
    if [[ $SETUP_INTERACTIVE != true ]]; then
        [[ -n ${SETUP_PASSWORD_FILE:-} && -r $SETUP_PASSWORD_FILE ]] ||
            setup_die 'First install requires an administrator. Run interactively or use --admin-password-file FILE.'
        username=${SETUP_USERNAME:-admin}
        unit=${SETUP_UNIT:-default}
        "$@" bootstrap-admin "$username" --unit "$unit" < "$SETUP_PASSWORD_FILE" >> "$SETUP_LOG" 2>&1 ||
            setup_die 'Administrator creation failed. See setup.log.'
    else
        printf '\nCreate the first OpenGovAI administrator.\n'
        while true; do
            read -r -p 'Username [admin]: ' username || setup_die 'Input was closed.'
            username=${username:-admin}
            read -r -p 'Business unit [default]: ' unit || setup_die 'Input was closed.'
            unit=${unit:-default}
            password=$(setup_read_secret 'Password (at least 12 characters): ') || setup_die 'Password input was interrupted.'
            confirmation=$(setup_read_secret 'Confirm password: ') || setup_die 'Password confirmation was interrupted.'
            if [[ "$password" != "$confirmation" ]]; then
                printf 'Passwords differ. Try again.\n'
                continue
            fi
            if message=$(printf '%s\n' "$password" | "$@" bootstrap-admin "$username" --unit "$unit" 2>&1); then
                unset password confirmation
                break
            fi
            printf '%s\n' "$message" | tail -n 1
            if [[ "$message" == *'An active administrator already exists.'* ]]; then
                setup_note 'An administrator was created by another setup.'
                return 0
            fi
            if [[ "$message" != *'Use a valid username'* && "$message" != *'already registered.'* ]]; then
                setup_die 'Administrator creation failed. Check service logs.'
            fi
        done
    fi
    setup_note "Administrator created for $unit. Sign-in username: $(printf '%s' "$username" | tr '[:upper:]' '[:lower:]')"
}

setup_local_check() {
    if setup_setting OPENGOVAI_POLICY_AI_LOCAL_URL; then
        if "$@" check-local-ai >> "$SETUP_LOG" 2>&1; then
            setup_note 'Local model test passed. Select Local policy model during policy import.'
        else
            setup_note 'Local model test failed. Check the model server and its address, then rerun setup. See setup.log.'
        fi
    else
        setup_note 'Local model setup deferred. Open Policies > Policy AI settings to configure a connection later.'
    fi
}

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then return; fi

set -euo pipefail
umask 077
cd "$(dirname "$0")"
ROOT=$(pwd -P)
SETUP_LOG="$ROOT/setup.log"
touch "$SETUP_LOG"
chmod 600 "$SETUP_LOG"
SETUP_INTERACTIVE=false
[[ -t 0 ]] && SETUP_INTERACTIVE=true
download=false
release='5.1.0'
requested_port=''
while (( $# )); do
    case "$1" in
        --download) download=true; shift ;;
        --non-interactive) SETUP_INTERACTIVE=false; shift ;;
        --skip-admin) SETUP_SKIP_ADMIN=true; shift ;;
        --port|--admin|--unit|--admin-password-file)
            (( $# >= 2 )) || setup_die "Missing value for $1."
            case "$1" in
                --port) requested_port=$2 ;;
                --admin) SETUP_USERNAME=$2 ;;
                --unit) SETUP_UNIT=$2 ;;
                --admin-password-file) SETUP_PASSWORD_FILE=$2 ;;
            esac
            shift 2 ;;
        -h|--help)
            printf '%s\n' 'Usage: ./install.sh [--download] [--port PORT] [--non-interactive [--admin USER] [--unit UNIT] --admin-password-file FILE | --skip-admin]'
            exit 0 ;;
        *) setup_die "Unknown option $1." ;;
    esac
done

setup_step 0 'Detecting host platform and Docker engine'
case "$(uname -s)" in
    Darwin) host_os=macOS ;;
    Linux)
        host_os=Linux
        if [[ -n ${WSL_DISTRO_NAME:-} ]] || grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then host_os='Windows (WSL)'; fi ;;
    *) setup_die 'Run this installer on macOS, Linux, or Windows using WSL with Docker integration.' ;;
esac
command -v docker >/dev/null || setup_die "Docker is required on $host_os. Install and start it, then rerun setup."
engine=$(docker info --format '{{.OSType}}/{{.Architecture}}' 2>> "$SETUP_LOG") ||
    setup_die 'Docker is unavailable. Start Docker and verify your Docker context.'
case "$engine" in
    linux/aarch64|linux/arm64) arch=arm64 ;;
    linux/x86_64|linux/amd64) arch=amd64 ;;
    *) setup_die 'Switch Docker to an x86-64 or ARM64 Linux engine.' ;;
esac
docker compose version >> "$SETUP_LOG" 2>&1 || setup_die 'Docker Compose v2 is required.'
setup_note "Host: $host_os ($(uname -m)); selected container platform: linux/$arch."

setup_step 1 'Locating and verifying the platform package'
image="images-$arch.tar.gz"
if [[ -f .env ]] && setup_setting OPENGOVAI_IMAGE_ARCH && ! grep -qx "OPENGOVAI_IMAGE_ARCH=$arch" .env; then
    setup_die 'The existing .env targets a different Docker architecture.'
fi
if [[ ! -f "$image" ]]; then
    if [[ "$download" != true && "$SETUP_INTERACTIVE" == true ]]; then
        read -r -p "Download the linux/$arch package from GitHub? [y/N]: " answer || setup_die 'Input was closed.'
        if [[ "$answer" == [yY] || "$answer" == [yY][eE][sS] ]]; then download=true; fi
    fi
    [[ "$download" == true ]] || setup_die "The $arch package is missing. Run ./install.sh --download from the expanded v5 directory."
    [[ "$release" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || setup_die 'Use the installer from a versioned release.'
    temp=$(mktemp -d)
    trap 'rm -rf -- "$temp"' EXIT
    package="opengovai-$release-client-$arch"
    curl --fail --location --silent --show-error --retry 2 \
        "https://github.com/sjanizacorp/opengovai/releases/download/v$release/$package.tar.gz" \
        -o "$temp/client.tar.gz" 2>> "$SETUP_LOG" || setup_die 'GitHub download failed.'
    tar -xOzf "$temp/client.tar.gz" "$package/$image" > "$temp/$image" ||
        setup_die 'Could not read the image from the downloaded platform package.'
    image_input="$temp/$image"
else
    image_input="$image"
fi
expected=$(awk -v image="$image" '$2 == image {print $1}' SHA256SUMS)
if command -v sha256sum >/dev/null; then actual=$(sha256sum "$image_input"); else actual=$(shasum -a 256 "$image_input"); fi
[[ -n "$expected" && "$expected" == "${actual%% *}" ]] || setup_die 'Image archive SHA-256 verification failed.'
if [[ "$image_input" != "$image" ]]; then mv "$image_input" "$image"; fi
docker image load --input "$image" >> "$SETUP_LOG" 2>&1 || setup_die 'Docker image loading failed. See setup.log.'

setup_step 2 'Preparing deployment settings'
if [[ ! -f .env ]]; then
    if [[ -z "$requested_port" && "$SETUP_INTERACTIVE" == true ]]; then
        read -r -p 'Dashboard port [3000]: ' requested_port || setup_die 'Input was closed.'
    fi
    cp .env.example .env
fi
chmod 600 .env
if [[ -n "$requested_port" ]]; then
    [[ "$requested_port" =~ ^[0-9]{1,5}$ ]] && (( 10#$requested_port >= 1 && 10#$requested_port <= 65535 )) ||
        setup_die 'Dashboard port must be between 1 and 65535. Rerun with --port PORT.'
    env_temp=$(mktemp "$ROOT/.setup-env.XXXXXX")
    if awk -v port="$((10#$requested_port))" '!/^[[:space:]]*PORT[[:space:]]*=/ {print} END {print "PORT=" port}' .env > "$env_temp"; then
        mv "$env_temp" .env
    else
        rm -f "$env_temp"
        setup_die 'Could not update the dashboard port.'
    fi
fi
setup_setting OPENGOVAI_IMAGE_ARCH || printf '\nOPENGOVAI_IMAGE_ARCH=%s\n' "$arch" >> .env
export OPENGOVAI_IMAGE_ARCH="$arch"
if ! setup_setting OPENGOVAI_POLICY_AI_STATE_KEY; then
    key=$(docker run --rm --pull never --network none --entrypoint python "opengovai-client-api:$release-$arch" \
        -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())' 2>> "$SETUP_LOG") ||
        setup_die 'Credential encryption initialization failed.'
    printf '\nOPENGOVAI_POLICY_AI_STATE_KEY=%s\n' "$key" >> .env
    unset key
fi
host=opengovai-model-host
if [[ "$(docker info --format '{{.OperatingSystem}}' 2>> "$SETUP_LOG")" == *'Docker Desktop'* ]]; then host=host.docker.internal; fi
setup_prompt_local "$host"

setup_step 3 'Starting services and waiting for readiness'
docker compose up -d --no-build --pull never --wait >> "$SETUP_LOG" 2>&1 ||
    setup_die 'Services did not become healthy. See setup.log and run docker compose logs api nginx.'
setup_step 4 'Preparing the administrator account'
setup_admin docker compose exec -T api opengovai manage
setup_step 5 'Checking optional local model'
setup_local_check docker compose exec -T api opengovai manage

address=$(docker compose port nginx 80) || setup_die 'Could not determine the dashboard address.'
setup_step 6 'Installation complete'
setup_note "Dashboard: http://$address"
setup_note "API health: http://$address/api/v1/health"
setup_note "Configuration: $ROOT/.env and $ROOT/compose.yaml"
setup_note "Installer: $ROOT/install.sh"
setup_note 'Application command: docker compose exec api opengovai'
setup_note 'Runtime logs: docker compose logs api frontend nginx'
setup_note 'Default database: /app/data/opengovai.sqlite in the api-data Compose volume'
setup_note "Setup log: $SETUP_LOG"
