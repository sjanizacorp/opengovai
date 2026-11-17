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


native_fetch() {
    if command -v curl >/dev/null; then
        curl --fail --location --silent --show-error --retry 2 --proto '=https' --proto-redir '=https' "$1" -o "$2"
    elif command -v wget >/dev/null; then
        wget --https-only --timeout=30 --tries=3 --quiet "$1" -O "$2"
    elif command -v python3 >/dev/null; then
        python3 -I - "$1" "$2" <<'PY'
import shutil
import sys
from urllib.request import urlopen

with urlopen(sys.argv[1], timeout=30) as response:
    if not response.geturl().startswith("https://"):
        raise ValueError("The download redirected to an insecure address.")
    with open(sys.argv[2], "wb") as destination:
        shutil.copyfileobj(response, destination)
PY
    else
        printf '%s\n' 'Downloading requires curl, wget, or an existing Python 3 with HTTPS support.' >&2
        return 1
    fi
}

setup_parse_install_dir() {
    setup_install_dir=''
    setup_install_dir_given=false
    setup_directory_interactive=false
    setup_directory_args=()
    [[ ! -t 0 ]] || setup_directory_interactive=true
    while (( $# )); do
        case "$1" in
            --install-dir)
                if (( $# < 2 )) || [[ -z "$2" || "$2" == --* ]]; then
                    printf '%s\n' 'Provide a folder after --install-dir.' >&2
                    return 1
                fi
                setup_install_dir=$2
                setup_install_dir_given=true
                shift 2 ;;
            --non-interactive)
                setup_directory_interactive=false
                setup_directory_args+=("$1"); shift ;;
            --port|--admin|--unit|--admin-password-file)
                if (( $# < 2 )); then printf 'Missing value for %s.\n' "$1" >&2; return 1; fi
                local value=$2
                if [[ "$1" == --admin-password-file && "$value" != /* ]]; then value="$PWD/$value"; fi
                setup_directory_args+=("$1" "$value"); shift 2 ;;
            *) setup_directory_args+=("$1"); shift ;;
        esac
    done
}

setup_resolve_install_dir() {
    local default=$1
    if [[ "$setup_install_dir_given" == false && "$setup_directory_interactive" == true ]]; then
        read -r -p "Installation folder [$default]: " setup_install_dir ||
            { printf '%s\n' 'Setup cancelled before selecting a folder.' >&2; return 1; }
    fi
    setup_install_dir=${setup_install_dir:-$default}
    case "$setup_install_dir" in
        '~') setup_install_dir=$HOME ;;
        '~/'*) setup_install_dir="$HOME/${setup_install_dir#\~/}" ;;
    esac
    if [[ "$setup_install_dir" != /* ]]; then setup_install_dir="$PWD/$setup_install_dir"; fi
    mkdir -p -- "$setup_install_dir" &&
        setup_install_dir=$(cd -- "$setup_install_dir" && pwd -P)
}

setup_same_package() {
    [[ -f "$1/.opengovai-package" && -x "$1/install.sh" ]] &&
        [[ "$(cat "$1/.opengovai-package")" == "$2" ]]
}

setup_require_empty_dir() (
    shopt -s nullglob dotglob
    local -a contents=("$1"/*)
    if (( ${#contents[@]} )); then
        printf 'Choose an empty installation folder, or run the installer already in %s.\n' "$1" >&2
        exit 1
    fi
)

setup_copy_package() (
    local source=$1 target=$2 item staging
    shift 2
    setup_require_empty_dir "$target" || exit 1
    for item in "$@"; do
        if [[ "$target" == "$source/$item" || "$target" == "$source/$item/"* ]]; then
            printf 'Choose an installation folder outside %s/%s.\n' "$source" "$item" >&2
            exit 1
        fi
    done
    staging=$(mktemp -d "$target/.opengovai-files.XXXXXX") || exit 1
    trap 'rm -rf -- "$staging"' EXIT
    for item in "$@"; do
        if [[ -e "$source/$item" ]]; then
            cp -Rp -- "$source/$item" "$staging/" || exit 1
        fi
    done
    for item in "$@"; do
        if [[ -e "$staging/$item" ]]; then
            mv -- "$staging/$item" "$target/$item" || exit 1
        fi
    done
)

install_native() {
unset PYTHONHOME PYTHONPATH
setup_step 0 'Checking native prerequisites'
setup_note "Detected $system ($arch)."
setup_note "Installation folder: $ROOT."
if [[ "$platform" == linux ]]; then
    libc=$(getconf GNU_LIBC_VERSION 2>/dev/null || true)
    [[ "$libc" =~ ^glibc[[:space:]]+([0-9]+)\.([0-9]+)$ ]] &&
        (( BASH_REMATCH[1] > 2 || (BASH_REMATCH[1] == 2 && BASH_REMATCH[2] >= 36) )) ||
        setup_die "$system requires glibc 2.36 or later for OpenGovAI. Use the Docker client on an older or musl-based distribution."
    setup_note "Linux runtime: $libc."
fi
compatible_python() {
    [[ -n "$1" ]] && "$1" -I -c '
import ensurepip, platform, sqlite3, ssl, sys, venv
supported = {"arm64": {"arm64", "aarch64"}, "amd64": {"amd64", "x86_64"}}
sys.exit(not (sys.implementation.name == "cpython" and sys.version_info[:2] == (3, 12)
             and platform.machine().lower() in supported[sys.argv[1]]))
' "$arch" >/dev/null 2>&1
}

provision_python() {
    local target checksum archive archive_hash temporary
    local build=20261110 version=3.12.16
    case "$platform-$arch" in
        macos-arm64) target=aarch64-apple-darwin; checksum=e956e60bc9465d577ef8062059aa05cd3a2665b4b8678a2ed24e432368330b8f ;;
        macos-amd64) target=x86_64-apple-darwin; checksum=83f2922437e6d546d0fcdb8c11f150a8e52787e8d9ea8651b1974e20908eb1bc ;;
        linux-arm64) target=aarch64-unknown-linux-gnu; checksum=4792f81750282597fb2a3389fe18b945ed2ba6aad5e45ad406d122c58cb33081 ;;
        linux-amd64) target=x86_64-unknown-linux-gnu; checksum=c2f87d4b4e8db3abddb0f116c6ccfc503d0cbdbb9ee8faacddad1b679ec12e99 ;;
    esac
    local managed="$ROOT/.python/cpython-$version-$build"
    python="$managed/bin/python3.12"
    if compatible_python "$python"; then
        setup_note "Reusing OpenGovAI's managed CPython $version."
        return
    fi
    [[ ! -e "$managed" && ! -L "$managed" ]] ||
        setup_die "The managed Python installation at $managed is incomplete. Remove that directory and rerun setup."
    setup_note "Downloading CPython $version for this installation."
    mkdir -p "$ROOT/.python"
    temporary=$(mktemp -d "$ROOT/.python/.download.XXXXXX")
    archive="cpython-$version+$build-$target-install_only.tar.gz"
    if ! native_fetch "https://github.com/astral-sh/python-build-standalone/releases/download/$build/$archive" \
        "$temporary/python.tar.gz" 2>> "$SETUP_LOG"; then
        rm -rf -- "$temporary"
        setup_die 'The Python download failed. See setup.log or supply a compatible interpreter with OPENGOVAI_PYTHON.'
    fi
    if command -v sha256sum >/dev/null; then
        archive_hash=$(sha256sum "$temporary/python.tar.gz")
    else
        archive_hash=$(shasum -a 256 "$temporary/python.tar.gz")
    fi
    if [[ "${archive_hash%% *}" != "$checksum" ]]; then
        rm -rf -- "$temporary"
        setup_die 'The downloaded Python archive failed SHA-256 verification.'
    fi
    if ! tar -xzf "$temporary/python.tar.gz" -C "$temporary" 2>> "$SETUP_LOG" ||
        ! compatible_python "$temporary/python/bin/python3.12" ||
        ! mv "$temporary/python" "$managed"; then
        rm -rf -- "$temporary"
        setup_die 'Could not unpack a compatible Python runtime. See setup.log.'
    fi
    rm -rf -- "$temporary"
    setup_note "Managed Python installed at $managed."
}

setup_step 1 'Preparing Python and creating the isolated virtual environment'
if [[ -f run/server.json ]]; then
    ./stop.sh >> "$SETUP_LOG" 2>&1 || setup_die 'Could not stop the existing instance.'
fi

if [[ -n ${OPENGOVAI_PYTHON:-} ]]; then
    python=$(command -v "$OPENGOVAI_PYTHON" || true)
    compatible_python "$python" ||
        setup_die "OPENGOVAI_PYTHON must point to CPython 3.12 with venv support for $arch. Unset it for automatic setup."
    setup_note "Using the configured interpreter at $python."
else
    python=''
    previous_base=''
    if [[ -x .venv/bin/python ]]; then
        previous_base=$(.venv/bin/python -I -c 'import sys; print(sys._base_executable)' 2>/dev/null || true)
    fi
    for candidate in "$previous_base" "$(command -v python3.12 || true)" "$(command -v python3 || true)"; do
        if compatible_python "$candidate"; then
            python=$candidate
            setup_note "Using compatible CPython at $python."
            break
        fi
    done
    [[ -n "$python" ]] || provision_python
fi

backup=''
if [[ -L .venv ]]; then
    setup_die 'Move the .venv symlink aside before installing.'
fi
if [[ -e .venv ]] && ! .venv/bin/python -I -c '
import os, sys
sys.exit(not (sys.prefix != sys.base_prefix and os.path.samefile(sys._base_executable, sys.argv[1])))
' "$python" >/dev/null 2>&1; then
    backup=$(mktemp -d "$ROOT/.venv-backup.XXXXXX")
    mv .venv "$backup/venv"
fi
if ! "$python" -I -m venv .venv >> "$SETUP_LOG" 2>&1 ||
    ! .venv/bin/python -I -m pip install --disable-pip-version-check -r runtime/requirements.txt >> "$SETUP_LOG" 2>&1; then
    if [[ -n "$backup" ]]; then
        rm -rf -- .venv
        mv "$backup/venv" .venv
        rmdir "$backup"
    fi
    setup_die 'Could not create the virtual environment or install its dependencies. See setup.log.'
fi
if [[ -n "$backup" ]]; then rm -rf -- "$backup"; fi
setup_note "Virtual environment: $ROOT/.venv"
./opengovai status >> "$SETUP_LOG" 2>&1 || setup_die 'The compiled runtime could not load. See setup.log.'

setup_step 2 'Preparing native settings'
if [[ ! -f .env ]]; then
    if [[ -z "$port" && "$SETUP_INTERACTIVE" == true ]]; then
        read -r -p 'Dashboard port [3000]: ' port || setup_die 'Input was closed.'
    fi
    cp .env.example .env
fi
chmod 600 .env
if [[ -n "$port" ]]; then
    [[ "$port" =~ ^[0-9]{1,5}$ ]] && (( 10#$port >= 1 && 10#$port <= 65535 )) ||
        setup_die 'Choose a dashboard port from 1 through 65535.'
    temporary=$(mktemp "$ROOT/.setup-env.XXXXXX")
    if awk -v port="$((10#$port))" '!/^[[:space:]]*PORT[[:space:]]*=/ {print} END {print "PORT=" port}' .env > "$temporary"; then
        mv "$temporary" .env
    else
        rm -f "$temporary"
        setup_die 'Could not update PORT in .env.'
    fi
fi
if ! setup_setting OPENGOVAI_POLICY_AI_STATE_KEY; then
    key=$(.venv/bin/python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())' 2>> "$SETUP_LOG") ||
        setup_die 'Could not initialize credential encryption.'
    printf '\nOPENGOVAI_POLICY_AI_STATE_KEY=%s\n' "$key" >> .env
    unset key
fi
setup_prompt_local 127.0.0.1
setup_step 3 'Starting OpenGovAI and checking readiness'
running=$(./start.sh 2>> "$SETUP_LOG") || setup_die 'Could not start OpenGovAI. See setup.log and logs/runtime.log.'
setup_note "$running"
setup_step 4 'Preparing the administrator account'
setup_admin ./opengovai manage
setup_step 5 'Checking optional local model'
setup_local_check ./opengovai manage
setup_step 6 'Installation complete'
setup_note "Dashboard: ${running##* }"
setup_note "Configuration: $ROOT/.env"
setup_note "Scripts: $ROOT/install.sh, $ROOT/start.sh, $ROOT/stop.sh, $ROOT/uninstall.sh"
setup_note "Application executable: $ROOT/opengovai"
setup_note "Python executable: $ROOT/.venv/bin/python"
setup_note "Default database: $ROOT/data/opengovai.sqlite"
setup_note "Runtime log: $ROOT/logs/runtime.log"
setup_note "Setup log: $SETUP_LOG"

}

install_docker() {
setup_step 0 'Checking Docker prerequisites'
docker compose version >> "$SETUP_LOG" 2>&1 || setup_die 'Docker Compose v2 is required.'
setup_note "Selected Docker platform: linux/$arch."
setup_note "Installation folder: $ROOT."

setup_step 1 'Verifying and loading the Docker images'
image="images-$arch.tar.gz"
if [[ -f .env ]] && setup_setting OPENGOVAI_IMAGE_ARCH && ! grep -qx "OPENGOVAI_IMAGE_ARCH=$arch" .env; then
    setup_die 'The existing .env targets a different Docker architecture.'
fi
expected=$(awk -v image="$image" '$2 == image {print $1}' SHA256SUMS)
[[ -n "$expected" && "$expected" == "$(setup_sha256 "$image")" ]] ||
    setup_die 'Image archive SHA-256 verification failed.'
docker image load --input "$image" >> "$SETUP_LOG" 2>&1 || setup_die 'Docker image loading failed. See setup.log.'

setup_step 2 'Preparing deployment settings'
if [[ ! -f .env ]]; then
    if [[ -z "$port" && "$SETUP_INTERACTIVE" == true ]]; then
        read -r -p 'Dashboard port [3000]: ' port || setup_die 'Input was closed.'
    fi
    cp .env.example .env
    if [[ -z ${COMPOSE_PROJECT_NAME:-} ]]; then
        if command -v sha256sum >/dev/null; then project_hash=$(printf '%s' "$ROOT" | sha256sum)
        else project_hash=$(printf '%s' "$ROOT" | shasum -a 256); fi
        printf '\nCOMPOSE_PROJECT_NAME=opengovai-%s\n' "${project_hash:0:12}" >> .env
    fi
fi
chmod 600 .env
if [[ -n "$port" ]]; then
    [[ "$port" =~ ^[0-9]{1,5}$ ]] && (( 10#$port >= 1 && 10#$port <= 65535 )) ||
        setup_die 'Dashboard port must be between 1 and 65535. Rerun with --port PORT.'
    env_temp=$(mktemp "$ROOT/.setup-env.XXXXXX")
    if awk -v port="$((10#$port))" '!/^[[:space:]]*PORT[[:space:]]*=/ {print} END {print "PORT=" port}' .env > "$env_temp"; then
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

}

set -euo pipefail
umask 077

release='5.1.5'
source_dir=$(cd "$(dirname "$0")" && pwd -P)
base="https://github.com/sjanizacorp/opengovai/releases/download/v$release"
setup_parse_install_dir "$@"
set -- ${setup_directory_args[@]+"${setup_directory_args[@]}"}
SETUP_INTERACTIVE=$setup_directory_interactive

usage() {
    cat <<'USAGE'
Usage: ./install.sh [--native | --docker] [--install-dir DIR] [--port PORT]
                    [--non-interactive] [--admin USER] [--unit UNIT]
                    [--admin-password-file FILE | --skip-admin]
       ./install.sh [--native | --docker] --print-platform

A standalone installer asks for the deployment mode and folder. A bundled
installer defaults to that bundle's mode. Without a terminal the standalone
installer defaults to native mode. Setup downloads the matching package when
needed. --install-dir accepts absolute paths, relative paths, and ~/ paths.
USAGE
}

mode=''
port=''
print_platform=false
while (( $# )); do
    case "$1" in
        --native|--local|--docker)
            selected=${1#--}
            if [[ "$selected" == local ]]; then selected=native; fi
            if [[ -n "$mode" && "$mode" != "$selected" ]]; then
                printf '%s\n' 'Choose one deployment mode.' >&2
                exit 1
            fi
            mode=$selected; shift ;;
        --non-interactive|--download) shift ;;
        --skip-admin) SETUP_SKIP_ADMIN=true; shift ;;
        --print-platform) print_platform=true; shift ;;
        --port|--admin|--unit|--admin-password-file)
            case "$1" in
                --port) port=$2 ;;
                --admin) SETUP_USERNAME=$2 ;;
                --unit) SETUP_UNIT=$2 ;;
                --admin-password-file) SETUP_PASSWORD_FILE=$2 ;;
            esac
            shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) printf 'Unknown option: %s\n' "$1" >&2; exit 1 ;;
    esac
done

bundle=''
if [[ -f "$source_dir/.opengovai-package" ]]; then
    bundle=$(cat "$source_dir/.opengovai-package")
fi
if [[ -z "$mode" ]]; then
    case "$bundle" in
        "native:$release:"*) mode=native ;;
        "docker:$release") mode=docker ;;
        *)
            if [[ "$SETUP_INTERACTIVE" == true && "$print_platform" == false ]]; then
                printf 'OpenGovAI installation\n\n  1) Native on this host\n  2) Docker Compose\n'
                while true; do
                    read -r -p 'Choose deployment mode [1]: ' choice || exit 1
                    case "$choice" in
                        ''|1|native) mode=native; break ;;
                        2|docker) mode=docker; break ;;
                        *) printf '%s\n' 'Enter 1 for native or 2 for Docker.' ;;
                    esac
                done
            else
                mode=native
            fi ;;
    esac
fi

if [[ "$mode" == docker ]]; then
    command -v docker >/dev/null ||
        { printf '%s\n' 'Install and start Docker with Compose v2, then rerun setup.' >&2; exit 1; }
    engine=$(docker info --format '{{.OSType}}/{{.Architecture}}') ||
        { printf '%s\n' 'Docker is unavailable. Start Docker and verify your Docker context.' >&2; exit 1; }
    case "$engine" in
        linux/aarch64|linux/arm64) arch=arm64 ;;
        linux/x86_64|linux/amd64) arch=amd64 ;;
        *) printf '%s\n' 'Switch Docker to an ARM64 or x86-64 Linux engine.' >&2; exit 1 ;;
    esac
    system='Docker Linux engine'
    name="opengovai-$release-client-$arch"
    package_id="docker:$release"
    payload="images-$arch.tar.gz"
    files=(install.sh compose.yaml SHA256SUMS .env.example README.md USER-GUIDE.md CLIENT-GUIDE.md screenshots
           manuals images-amd64.tar.gz images-arm64.tar.gz .opengovai-package)
else
    case "$(uname -s)" in
        Darwin) platform=macos; system=macOS ;;
        Linux)
            platform=linux
            system=$(awk -F= '$1=="PRETTY_NAME" {sub(/^PRETTY_NAME=/,""); gsub(/^"|"$/,""); print; exit}' /etc/os-release 2>/dev/null || true)
            system=${system:-Linux} ;;
        *) printf '%s\n' 'Native OpenGovAI requires macOS or Linux.' >&2; exit 1 ;;
    esac
    machine=$(uname -m)
    if [[ "$platform" == macos && $(sysctl -n hw.optional.arm64 2>/dev/null || true) == 1 ]]; then machine=arm64; fi
    case "$platform/$machine" in
        macos/arm64) arch=arm64; artifact=macos-apple-silicon-arm64 ;;
        macos/x86_64|macos/amd64) arch=amd64; artifact=macos-intel-x86-64 ;;
        linux/arm64|linux/aarch64) arch=arm64; artifact=linux-arm64 ;;
        linux/x86_64|linux/amd64) arch=amd64; artifact=linux-x86-64 ;;
        *) printf '%s\n' 'Native OpenGovAI requires ARM64 or x86-64.' >&2; exit 1 ;;
    esac
    name="opengovai-$release-native-$artifact"
    package_id="native:$release:$platform-$arch"
    payload=runtime/requirements.txt
    files=(install.sh start.sh stop.sh uninstall.sh opengovai README.md .env.example runtime web manuals .opengovai-package)
fi

if [[ "$print_platform" == true ]]; then
    printf '%s (%s): %s.tar.gz\n' "$system" "$arch" "$name"
    exit 0
fi

preferred_dir="$PWD/$name"
if setup_same_package "$source_dir" "$package_id" && [[ -f "$source_dir/$payload" ]]; then
    preferred_dir=$source_dir
fi
setup_resolve_install_dir "$preferred_dir"
ROOT=$setup_install_dir

setup_sha256() {
    local digest
    if command -v sha256sum >/dev/null; then digest=$(sha256sum "$1")
    else digest=$(shasum -a 256 "$1"); fi
    printf '%s\n' "${digest%% *}"
}

download_package() (
    set -e
    local scratch checksums expected archive
    scratch=$(mktemp -d) || exit 1
    trap 'rm -rf -- "$scratch"' EXIT
    checksums="$scratch/RELEASE-SHA256SUMS"
    archive="$scratch/client.tar.gz"
    printf 'Detected %s (%s). Downloading %s.tar.gz.\n' "$system" "$arch" "$name"
    native_fetch "$base/RELEASE-SHA256SUMS" "$checksums"
    expected=$(awk -v name="$name.tar.gz" '$2 == name {print $1}' "$checksums")
    if [[ ! "$expected" =~ ^[[:xdigit:]]{64}$ ]]; then
        printf '%s\n' 'The release checksum is missing.' >&2
        exit 1
    fi
    native_fetch "$base/$name.tar.gz" "$archive"
    if [[ "$expected" != "$(setup_sha256 "$archive")" ]]; then
        printf '%s\n' 'SHA-256 verification failed.' >&2
        exit 1
    fi
    tar -xzf "$archive" -C "$scratch"
    setup_same_package "$scratch/$name" "$package_id"
    test -f "$scratch/$name/$payload"
    setup_copy_package "$scratch/$name" "$ROOT" "${files[@]}"
)

if ! setup_same_package "$ROOT" "$package_id" || [[ ! -f "$ROOT/$payload" ]]; then
    if [[ "$preferred_dir" == "$source_dir" ]]; then
        setup_copy_package "$source_dir" "$ROOT" "${files[@]}"
    else
        setup_require_empty_dir "$ROOT"
        download_package
    fi
fi

cd "$ROOT"
SETUP_LOG="$ROOT/setup.log"
touch "$SETUP_LOG"
chmod 600 "$SETUP_LOG"
setup_note "Deployment mode: $mode."
if [[ "$mode" == docker ]]; then install_docker; else install_native; fi
