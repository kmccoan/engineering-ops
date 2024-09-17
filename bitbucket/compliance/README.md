# Managing runtimes
We use [`asdf`](https://asdf-vm.com/) to manage the Deno version. `asdf` is a CLI tool that can manage multiple language runtime versions on a per-project basis.

Start by installing asdf:
```sh
brew install asdf
echo -e "\n. $(brew --prefix asdf)/libexec/asdf.sh" >> ${ZDOTDIR:-~}/.zshrc
```

Then install the asdf-node plugin:
```sh
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
```

Finally, install the versions specified in [`.tool-versions`](/.tool-versions) with a single command:
```sh
asdf install
```
Now if you run `asdf current` you should see the installed Node versions.

# Configuring:
Create a config.js with the following:
```js
export default {
    //https://bitbucket.org/account/settings/
    BITBUCKET_USERNAME: "<username - NOT EMAIL>",

    // https://bitbucket.org/account/settings/app-passwords/
    BITBUCKET_PASSWORD: "<app password>",

    BITBUCKET_WORKSPACE_REPOSITORIES: ["<workspace>/<repo-name>"],
    FROM_DATE: new Date(Date.parse("Jun 1, 2024"))
 }
```

# Running
```sh
npm install
npm run unapproved-check > result.txt
```