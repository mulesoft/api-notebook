{{/*
Generate the image name with the registry host and org. If host or org are not
passed in then omit them.
Keeps the values tidy and intentional.
*/}}
{{- define "image-name" -}}
  {{- $image := list .Values.image.registry .Values.image.org .Values.image.name -}}
  {{/* remove empty values in the list */}}
  {{- $image := without $image "" -}}
  {{/* join the reminaing string to form a docker hostname */}}
  {{- $image := $image | join "/" }}
  {{- $tag := default "latest" .Values.image.tag }}
  {{- printf "%s:%s" $image $tag -}}
{{- end -}}

{{/*
Generate a name for image registry pull secret if missing or used
passed in value. Also generates the imagePullSecret block
*/}}
{{- define "image-pull-secret-name" -}}
  {{- if or (.Values.image.pullSecret) (.Values.image.pullSecretName) }}
    {{- $name := default .Chart.Name .Values.nameOverride -}}
    {{- $secret := printf "%s-pull-secret" $name -}}
    {{- $sm := default $secret .Values.image.pullSecretName -}}
imagePullSecrets:
- name: {{ $sm }}
  {{- end }}
{{- end -}}
