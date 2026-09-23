# Market Modeling — Criteria Reference
# Sourced by market-modeling-run.sh via: source <(grep -E '^[A-Z_]+=')

MIN_SOURCES=5                    # minimum non-corporate sources for full run
MIN_SOURCES_QUICK=2              # minimum for quick scan
CONVERGENCE_THRESHOLD=3          # traditions that must agree to declare a finding load-bearing

# Source targets per tradition cluster (used in Harvester prompts)
TRADITION_A_TARGETS="nber.org arxiv.org ssrn.com jstor.org jasss.org aeaweb.org ideas.repec.org"
TRADITION_B_TARGETS="imf.org worldbank.org oecd.org bis.org ecb.europa.eu ec.europa.eu/eurostat"
TRADITION_C_TARGETS="santafe.edu inet.ox.ac.uk postkeynesian.net levyinstitute.org stockholmresilience.org degrowth.info greattransition.org pmc.ncbi.nlm.nih.gov"

# LLM settings — automated/CLI mode
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
MM_MODEL="${MM_MODEL:-claude-sonnet-4-6}"
ANTHROPIC_API_VERSION="2023-06-01"

# Output paths (relative to project root)
RUNS_DIR="${RUNS_DIR:-.market-modeling-runs}"
