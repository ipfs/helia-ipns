import type dnsPacket from 'dns-packet'

declare module 'dns-packet' {
  interface DecodedPacket extends dnsPacket.Packet {
    flag_aa: boolean
    flag_ad: boolean
    flag_cd: boolean
    flag_qr: boolean
    flag_ra: boolean
    flag_rd: boolean
    flag_tc: boolean
    flag_z: boolean
  }
  function decode (buf: Buffer, offset?: number): DecodedPacket
}
