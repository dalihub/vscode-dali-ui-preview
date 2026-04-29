# Install Docker

The DALi runtime needs Docker to run. If you already have Docker
installed and `docker info` works without `sudo`, skip to step 3.

## One-time install (Ubuntu / Debian)

Click **"Install via Terminal"** below. The extension opens a terminal
and pre-fills the install command — you only need to enter your sudo
password once.

```bash
curl -fsSL https://get.docker.com | sudo sh \
  && sudo usermod -aG docker $USER \
  && sudo systemctl enable --now docker
```

## After install: reboot is recommended

Linux applies the new `docker` group only at the start of a fresh
session. Some Ubuntu setups (gdm autologin, snap-installed Docker) keep
the old group list across logout/login — only a **reboot** reliably
refreshes it.

```bash
sudo reboot
```

After the system comes back, reopen this folder and continue with step 3.

## Verify it's working

Once Docker is installed and your session has the new group, run the
**"Verify Docker Access"** command from the Command Palette
(`Ctrl+Shift+P`). You should see the green confirmation message.

If you get a `permission denied` error, your session still doesn't have
the docker group — reboot and try again.
