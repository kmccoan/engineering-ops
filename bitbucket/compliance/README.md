# Managing runtimes
We use [`asdf`](https://asdf-vm.com/) to manage the Deno version. `asdf` is a CLI tool that can manage multiple language runtime versions on a per-project basis.

Start by installing asdf:
```sh
brew install asdf
echo -e "\n. $(brew --prefix asdf)/libexec/asdf.sh" >> ${ZDOTDIR:-~}/.zshrc
```

Then install the asdf-deno plugin:
```sh
asdf plugin-add deno https://github.com/asdf-community/asdf-deno.git
```

Finally, install the versions specified in [`.tool-versions`](/.tool-versions) with a single command:
```sh
asdf install
```
Now if you run `asdf current` you should see the installed Node versions.

# Running
```sh
npm install
npm run unapproved-check
```