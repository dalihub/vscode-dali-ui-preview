# Install Docker (Recommended path)

Skip this step if you picked Native runtime in step 2 — Docker is not
needed in that case.

If `docker info` already runs without `sudo`, you can skip ahead to
step 5.

## One-time install (Ubuntu / Debian)

Click **"Install via Terminal"** below. The extension opens an
integrated terminal and pre-fills the install command — you only need
to enter your sudo password once.

```bash
curl -fsSL https://get.docker.com | sudo sh \
  && sudo usermod -aG docker $USER \
  && sudo systemctl enable --now docker
```

## After install: reboot is recommended

Linux applies the new `docker` group only at the start of a fresh
session. Some Ubuntu setups (gdm autologin, snap-installed Docker)
keep the old group list across logout/login — only a **reboot**
reliably refreshes it.

```bash
sudo reboot
```

After the system comes back, reopen this folder. Run
**"Verify Docker Access"** to confirm — you should see a green
confirmation message. If you get a permission error, reboot again.
