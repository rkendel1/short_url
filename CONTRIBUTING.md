# Contributing to sho.rt

Thanks for your interest! Here's how you can help.

## Setup

### Web Development
```bash
cd web
npm install
npm run dev
```

Visit `http://localhost:3000`

### Rust CLI Development
```bash
cargo build
cargo run -- --help
```

## Testing

### Web
```bash
cd web
npm run build
npm run lint
```

### Rust
```bash
cargo test
cargo clippy
```

## Code Style

- **Web**: Follow Prettier/ESLint defaults (run `npm run lint`)
- **Rust**: Follow rustfmt (run `cargo fmt`)

## PR Guidelines

1. Make changes on a feature branch
2. Keep PRs focused on a single feature/fix
3. Update README if adding new functionality
4. Ensure tests pass locally
5. Include a clear description of changes

## Areas for Contribution

- [ ] UI/UX improvements
- [ ] Advanced analytics
- [ ] Link expiration
- [ ] Bulk operations
- [ ] Additional security features
- [ ] Documentation

## Questions?

Open an issue or discussion thread.
