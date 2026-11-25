# Ramen Rush — Tiny Counter, Big Flavour

Entry for the make.fun bounty **"Make the best cooking game"**
(`best-cooking-game-20261125-0137`).

An original counter-cooking game that plays offline in a desktop browser.
You run a tiny ramen counter for one 120-second shift:

- Tickets land on the **order board** — each shows a recipe as a row of
  ingredient chips and a patience bar that keeps draining.
- Click an **ingredient station** (or press `1`–`8`) to build the bowl in
  ticket order. The next needed ingredient glows gold.
- A wrong ingredient splashes: combo lost, patience cut.
- **Serve** a finished bowl (Space) for its price plus a speed bonus, and
  chain serves into combos worth extra coins. Let a ticket expire and you
  lose a star — lose all three and the shift ends early.
- Finished bowls land on **the pass**, steaming, while you work the next one.

Everything is drawn with code on a canvas — kitchen, lanterns, customers,
bowls and toppings — so the game is fully self-contained: no assets, no
network, no build step.

## Run it

Serve the `game/` folder with any static file server and open `index.html`
in desktop Chrome, e.g.:

```
python3 -m http.server --directory game 8080
# then open http://localhost:8080
```

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` using
`buildDossier` from `vendor/makefun-game.ts`:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are real renders of the game, staged through
the deterministic scenes in `shots.json` (`?shot=title|play|fever|end`).

## License

MIT — see `LICENSE`.
