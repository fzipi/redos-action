# ReDOS Action

[![GitHub Super-Linter](https://github.com/actions/javascript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/javascript-action/actions/workflows/ci.yml/badge.svg)

This action will run over the passed files and check for ReDOS vulnerabilities.

Each file must have a single regular expression per line.

## Inputs

### `files`

A list of files to check for ReDOS vulnerabilities. It is required, and should
be used as glob pattern.

Example: `compiled/*`

## Usage

You can now validate the action by referencing it in a workflow file. For
example, [`ci.yml`](./.github/workflows/ci.yml) demonstrates how to reference an
action in the same repository.

```yaml
steps:
  - name: Checkout
    id: checkout
    uses: actions/checkout@v3

  - name: Compiled files
    id: compiled
    run:
      echo "a{1,1000}b" > compiled/file1.txt && echo "a{1,1000}b" >
      compiled/file2.txt

  - name: Run ReDOS Action
    id: redos
    action: fzipi/redos-action@v1
    with:
      files: 'compiled/*'
```

## License

The scripts and documentation in this project are released under the
[MIT License](LICENSE)

