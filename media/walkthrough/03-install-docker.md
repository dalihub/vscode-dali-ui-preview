# Install Docker (Recommended path)

Skip this step if you picked Native runtime in step 2 — Docker is not
needed in that case.

If `docker info` already runs without `sudo`, you can skip ahead to
step 5.

## One-time install (Ubuntu / Debian)

Click **"Install via Terminal"** below. The extension opens an
integrated terminal and pre-fills the install command — you only need
to enter your sudo password **once**. After that, installation,
permissions, and the runtime download proceed automatically.

```bash
curl -fsSL https://get.docker.com | sudo sh \
  && sudo usermod -aG docker "$(id -un)" \
  && sudo systemctl enable --now docker \
  && sudo setfacl -m "u:$(id -u):rw" /var/run/docker.sock
```

## No reboot needed

Normally Linux applies the new `docker` group only at the start of a
fresh session — which would force a logout or reboot. The final
`setfacl` line sidesteps that: it grants **this** session access to the
docker socket immediately (file ACLs are evaluated when a connection is
made, not cached when a process starts), so the already-running VS Code
can use Docker right away.

The extension detects this automatically and continues setup — you do
**not** need to reboot or reload VS Code. Run **"Verify Docker Access"**
to confirm; you should see a green confirmation message.

> The `usermod -aG docker` line makes the membership permanent for
> future sessions, so the ACL only has to bridge the current one. If the
> docker daemon is later restarted and access drops, re-run
> **"Verify Docker Access"** → **"Fix for this session"**.
>
> The ACL is granted by **numeric UID** (`u:$(id -u)`), not by username:
> `setfacl` resolves a name through the local passwd database, which fails
> for networked (LDAP/AD) logins with `Invalid argument near character 3`.
> A numeric UID needs no lookup, so it works for every account type.
