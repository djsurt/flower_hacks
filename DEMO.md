# Comply Cofounder demo

## Start

```bash
cd web
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run dev
```

Open <http://localhost:3000>.

## Five-minute walkthrough

1. Start a plan with `389 Jane Stanford Way, Stanford, CA 94305` and choose **Restaurant**.
2. On **Overview**, explain that the baseline plan is deterministic: the same profile always produces the same steps, dates and costs.
3. In **Plan copilot**, choose **Run 4 agents**. Point out the Flower federation, Hub decomposition and privacy-preserving task envelope.
4. Four specialist cards progress independently through search, fetch, Kimi analysis and Grid reply stages.
5. Explain the architecture while they run: the Hub obtains controlled evidence and Flower Grid distributes narrow tasks to City, County, State and Employer SuperNodes.
6. After `4/4 replies`, open the official sources and compare confidence and findings.
7. Select two candidates and choose **Approve selected changes**. This demonstrates that agents propose changes but a human controls the plan overlay.
8. Return to **Roadmap**, **Costs**, **Location**, and **Grants & help** to show the rest of the product.

## Honest scope statement

The Research screen is a demo replay because the shared SuperGrid queue was too slow during the time-boxed build. The screen explicitly labels this. Live tests did verify node discovery, node role identity, Hub/node Grid messaging, and Kimi through Flower Runtime. See `docs/spike-results.md`.
