# LangTailor Electron IDE — Manual UAT Checklist

Sign off before tagging `langtailor-v*`.

## Dual-view sync

- [ ] Add node on canvas → corresponding `nodes/<id>.py` appears in code view
- [ ] Remove node with custom code → confirm dialog warns about data loss; cancel keeps node
- [ ] Remove node after confirm → file removed from code tree
- [ ] Edit custom region in code view → saved in `.langstitch.json` on save
- [ ] Select node on canvas → code view reveals matching module

## IDE shell

- [ ] Command palette (Ctrl/Cmd+Shift+P) lists view and panel commands
- [ ] Quick Open (Ctrl/Cmd+P) finds generated Python files
- [ ] Activity bar toggles Explorer, Search, SCM, Run, Extensions
- [ ] Bottom panel: Terminal, Problems, Output, Debug Console
- [ ] Status bar shows graph name, view mode, dirty state, problem counts

## Run / debug / test

- [ ] Build scaffolds Python project to output directory
- [ ] Run starts langstitch server (or equivalent)
- [ ] Test runs eval_runner / pytest
- [ ] Debugger attaches (debugpy) and stops on breakpoint

## Git

- [ ] SCM panel shows modified files after edit
- [ ] Stage and commit from SCM panel

## Packaging

- [ ] Double-click `.langstitch.json` opens LangTailor
- [ ] `langtailor:` protocol handler registered
- [ ] Session restore reopens last view mode and layout after quit
- [ ] Auto-update checks GitHub Releases feed (dry-run on beta channel)
- [ ] Signed build passes OS SmartScreen / Gatekeeper (when certs configured)

## Plugins

- [ ] Install marketplace component via native plugin host
- [ ] Component appears in canvas palette and exports correctly

## Export

- [ ] Export ZIP contains valid Python project (`pip install -e .`, `compileall`)
