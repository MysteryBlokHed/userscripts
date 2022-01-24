# UserScripts

GreaseMonkey UserScripts I've written.

## Installing scripts

To install a script, go to the folder of the script you want and select the file ending in `.user.js`.

### Directly from GitLab

Press the button in the middle of these three at the top-right of the file contents:

![Preview of Buttons](img/gitlab_buttons.png)

### Directly from GitHub

Pres the "Raw" button at the top-right of the file contents:

![Preview of Buttons](img/github_buttons.png)

## Building (Only needed for development)

Some scripts are written in TypeScript and need to be built to JavaScript before use.

```sh
# install dependencies
yarn install

# build
yarn build
```

Build files should be committed to the repo to avoid forcing users to build the scripts themselves.

## License

These scripts are licensed under the GNU General Public License, Version 3.0
([LICENSE](LICENSE) or <https://www.gnu.org/licenses/gpl-3.0.en.html>).
